/**
 * POST /api/commercial/attom-enrich
 *
 * Enriches a site analysis report with ATTOM Data — demographics, consumer
 * spend, and housing data fetched directly from ATTOM's licensed API.
 *
 * Use this when the uploaded PDF lacks demographic/spend data, or when the
 * user wants independent data to validate or supplement their uploaded report.
 *
 * Flow:
 *   1. Validate plan access (commercial+) and rate limit
 *   2. Geocode via ATTOM to get lat/lng + attomId
 *   3. Fetch all three radius rings (1/3/5 mi) in parallel
 *   4. Normalize to PropertyDemographic / PropertyConsumerSpend schema
 *   5. Merge onto the existing site report (ATTOM fills gaps; existing data wins)
 *   6. Re-run grading engine with enriched data
 *   7. Return new gradeId
 *
 * Idempotent: calling with the same reportId replaces previous ATTOM data.
 *
 * Requires: commercial | brokerage | enterprise plan + ATTOM_API_KEY env var
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { siteReports, propertyGrades, gradeWeights } from '@/lib/db/schema'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { captureError } from '@/lib/monitoring'
import { rateLimitAPI } from '@/lib/ratelimit'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { enrichWithAttom, AttomEnrichmentError } from '@/lib/attom-enrichment'
import {
  scoreTraffic,
  scoreConsumerSpend,
  scoreHouseholdIncome,
  scoreDemographics,
  scoreAnchorTenants,
  computeOverallScore,
  scoreToGrade,
  generateGradeNarrative,
  DEFAULT_GRADE_WEIGHTS,
  redistributeWeightsExcluding,
} from '@/lib/property-grader'
import type { PlanTier } from '@/lib/plans'
import type { PropertyGradeWeights } from '@/lib/db/schema'

export const runtime = 'nodejs'
export const maxDuration = 60

const RequestSchema = z.object({
  reportId: z.string().uuid(),
  // When true, ATTOM data overwrites any existing data in the report.
  // When false (default), ATTOM only fills null fields.
  overwrite: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await rateLimitAPI(request.headers.get('x-forwarded-for') ?? userId)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { reportId, overwrite } = parsed.data

  const dbUser = await getUserWithDetails(userId)
  if (!dbUser?.organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const sub = dbUser.organization.subscriptions?.[0]
  const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier

  if (!canAccess(plan, 'attom_enrichment')) {
    return NextResponse.json(
      { error: 'ATTOM enrichment requires the Commercial plan or higher.' },
      { status: 403 }
    )
  }

  if (!process.env.ATTOM_API_KEY) {
    return NextResponse.json(
      { error: 'ATTOM Data is not configured on this instance. Contact support.' },
      { status: 501 }
    )
  }

  // Fetch report — scoped to org for row-level security
  const report = await db.query.siteReports.findFirst({
    where: and(
      eq(siteReports.id, reportId),
      eq(siteReports.orgId, dbUser.organization.id)
    ),
  })

  if (!report) {
    return NextResponse.json({ error: 'Site analysis report not found' }, { status: 404 })
  }

  // ── Step 1: ATTOM enrichment ──────────────────────────────────
  let attomResult
  try {
    attomResult = await enrichWithAttom({
      address: report.propertyAddress,
      city: report.propertyCity,
      state: report.propertyState,
      zip: report.propertyZip,
    })
  } catch (err) {
    if (err instanceof AttomEnrichmentError) {
      if (err.code === 'NO_API_KEY') {
        return NextResponse.json(
          { error: 'ATTOM API key not configured. Add ATTOM_API_KEY to your environment.' },
          { status: 501 }
        )
      }
      if (err.code === 'NOT_FOUND') {
        return NextResponse.json(
          { error: `ATTOM could not locate this address: ${report.propertyAddress}. Try adding city/state/zip to the report.` },
          { status: 422 }
        )
      }
      return NextResponse.json({ error: `ATTOM error: ${err.message}` }, { status: 502 })
    }
    captureError(err instanceof Error ? err : new Error(String(err)), {
      context: 'attom_enrichment',
      reportId,
    })
    return NextResponse.json({ error: 'ATTOM enrichment failed unexpectedly' }, { status: 500 })
  }

  // ── Step 2: Merge onto report ─────────────────────────────────
  // Strategy: when overwrite=false, existing non-null data wins.
  // This lets users layer ATTOM on top of their PDF without losing
  // PDF data that ATTOM might not have (e.g. specific retailer sales volumes).
  const mergedDemographics = overwrite
    ? attomResult.demographics
    : {
        oneMile: report.demographics?.oneMile ?? attomResult.demographics.oneMile,
        threeMile: report.demographics?.threeMile ?? attomResult.demographics.threeMile,
        fiveMile: report.demographics?.fiveMile ?? attomResult.demographics.fiveMile,
      }

  const mergedConsumerSpend = overwrite
    ? attomResult.consumerSpend
    : {
        oneMile: report.consumerSpend?.oneMile ?? attomResult.consumerSpend.oneMile,
        threeMile: report.consumerSpend?.threeMile ?? attomResult.consumerSpend.threeMile,
        fiveMile: report.consumerSpend?.fiveMile ?? attomResult.consumerSpend.fiveMile,
      }

  const mergedHousingData = overwrite
    ? attomResult.housingData
    : (report.housingData ?? attomResult.housingData)

  // ATTOM geocode is always authoritative for lat/lng (it's more precise than
  // the Places geocoder we use during PDF upload)
  await db.update(siteReports)
    .set({
      demographics: mergedDemographics as any,
      consumerSpend: mergedConsumerSpend as any,
      housingData: mergedHousingData as any,
      propertyLat: attomResult.geocode.lat.toFixed(7) as any,
      propertyLng: attomResult.geocode.lng.toFixed(7) as any,
      updatedAt: new Date(),
    })
    .where(eq(siteReports.id, reportId))

  // ── Step 3: Re-grade with enriched data ───────────────────────
  const weightsRow = await db.query.gradeWeights.findFirst({
    where: eq(gradeWeights.orgId, dbUser.organization.id),
  })
  const baseWeights: PropertyGradeWeights = weightsRow
    ? {
        traffic: Number(weightsRow.traffic),
        consumerSpend: Number(weightsRow.consumerSpend),
        householdIncome: Number(weightsRow.householdIncome),
        demographics: Number(weightsRow.demographics),
        anchorTenant: Number(weightsRow.anchorTenant),
      }
    : DEFAULT_GRADE_WEIGHTS

  // Use enriched data for scoring — fall back to report's existing data for
  // dimensions ATTOM doesn't cover (traffic counts, anchor tenants)
  const trafficScore       = scoreTraffic(report.trafficCounts ?? [])
  const consumerSpendScore = scoreConsumerSpend(mergedConsumerSpend?.threeMile)
  const householdIncScore  = scoreHouseholdIncome(mergedDemographics?.threeMile)
  const demographicsScore  = scoreDemographics(mergedDemographics?.threeMile)
  const { score: anchorScore, hasData: anchorHasData, anchors } =
    scoreAnchorTenants(report.nearbyRetailers ?? [])

  const effectiveWeights = anchorHasData
    ? baseWeights
    : redistributeWeightsExcluding('anchorTenant', baseWeights)

  const overallScore = computeOverallScore(
    {
      traffic: trafficScore,
      consumerSpend: consumerSpendScore,
      householdIncome: householdIncScore,
      demographics: demographicsScore,
      anchorTenant: anchorScore,
    },
    effectiveWeights
  )

  const overallGrade = scoreToGrade(overallScore)

  let narrative = null
  try {
    narrative = await generateGradeNarrative({
      address: report.propertyAddress,
      overallGrade,
      overallScore,
      trafficScore,
      consumerSpendScore,
      householdIncomeScore: householdIncScore,
      demographicsScore,
      anchorTenantScore: anchorScore,
      anchors,
      demographics: mergedDemographics?.threeMile ?? null,
      trafficCounts: report.trafficCounts ?? [],
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), { reportId })
  }

  const [grade] = await db.insert(propertyGrades).values({
    orgId: dbUser.organization.id,
    userId: dbUser.id,
    siteReportId: reportId,
    overallGrade: overallGrade as any,
    overallScore: overallScore.toFixed(2),
    trafficScore: trafficScore.toFixed(2),
    trafficGrade: scoreToGrade(trafficScore) as any,
    consumerSpendScore: consumerSpendScore.toFixed(2),
    consumerSpendGrade: scoreToGrade(consumerSpendScore) as any,
    householdIncomeScore: householdIncScore.toFixed(2),
    householdIncomeGrade: scoreToGrade(householdIncScore) as any,
    demographicsScore: demographicsScore.toFixed(2),
    demographicsGrade: scoreToGrade(demographicsScore) as any,
    anchorTenantScore: anchorScore.toFixed(2),
    anchorTenantGrade: (anchorHasData ? scoreToGrade(anchorScore) : 'F') as any,
    anchorTenants: anchors as any,
    aiSummary: narrative?.summary ?? null,
    aiStrengths: narrative?.strengths ?? null,
    aiRisks: narrative?.risks ?? null,
    aiRecommendation: narrative?.recommendation ?? null,
    weightsSnapshot: effectiveWeights as any,
  }).returning()

  return NextResponse.json({
    gradeId: grade.id,
    attomId: attomResult.geocode.attomId,
    dataAdded: {
      demographics: {
        oneMile: attomResult.demographics.oneMile !== null,
        threeMile: attomResult.demographics.threeMile !== null,
        fiveMile: attomResult.demographics.fiveMile !== null,
      },
      consumerSpend: {
        oneMile: attomResult.consumerSpend.oneMile !== null,
        threeMile: attomResult.consumerSpend.threeMile !== null,
        fiveMile: attomResult.consumerSpend.fiveMile !== null,
      },
      housingData: attomResult.housingData !== null,
    },
    coords: {
      lat: attomResult.geocode.lat,
      lng: attomResult.geocode.lng,
    },
  })
}
