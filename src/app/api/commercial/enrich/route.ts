/**
 * POST /api/commercial/enrich
 *
 * Enriches a CoStar report's anchor tenant data using Google Places API
 * when the original PDF lacked nearby retailer information.
 *
 * Flow:
 *   1. Geocode address (or use stored lat/lng)
 *   2. Query Google Places Nearby Search for retail establishments
 *   3. Patch nearbyRetailers + lat/lng on the costar_report
 *   4. Re-grade with the enriched retailer data
 *
 * Requires: commercial | brokerage | enterprise plan
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { costarReports, propertyGrades, gradeWeights } from '@/lib/db/schema'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { captureError } from '@/lib/monitoring'
import { rateLimitAPI } from '@/lib/ratelimit'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { enrichWithPlacesData, PlacesEnrichmentError } from '@/lib/places-enrichment'
import {
  scoreTraffic, scoreConsumerSpend, scoreHouseholdIncome,
  scoreDemographics, scoreAnchorTenants, computeOverallScore,
  scoreToGrade, generateGradeNarrative, DEFAULT_GRADE_WEIGHTS,
  redistributeWeightsExcluding,
} from '@/lib/property-grader'
import type { PlanTier } from '@/lib/plans'
import type { CostarGradeWeights } from '@/lib/db/schema'

export const runtime = 'nodejs'
export const maxDuration = 60

const RequestSchema = z.object({
  reportId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await rateLimitAPI(request.headers.get('x-forwarded-for') ?? userId)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { reportId } = parsed.data

  const dbUser = await getUserWithDetails(userId)
  if (!dbUser?.organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const sub = dbUser.organization.subscriptions?.[0]
  const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
  if (!canAccess(plan, 'costar_integration')) {
    return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
  }

  const report = await db.query.costarReports.findFirst({
    where: and(
      eq(costarReports.id, reportId),
      eq(costarReports.orgId, dbUser.organization.id)
    ),
  })

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // ── Step 1: Places enrichment ─────────────────────────────────
  let enrichment
  try {
    enrichment = await enrichWithPlacesData({
      address: report.propertyAddress,
      city: report.propertyCity,
      state: report.propertyState,
      zip: report.propertyZip,
      lat: report.propertyLat ? Number(report.propertyLat) : null,
      lng: report.propertyLng ? Number(report.propertyLng) : null,
    })
  } catch (err) {
    if (err instanceof PlacesEnrichmentError) {
      if (err.code === 'NO_API_KEY') {
        return NextResponse.json(
          { error: 'Google Places API is not configured. Add GOOGLE_PLACES_API_KEY to your environment.' },
          { status: 501 }
        )
      }
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    captureError(err instanceof Error ? err : new Error(String(err)), { reportId })
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }

  // ── Step 2: Patch the report with enriched retailer data ──────
  await db.update(costarReports)
    .set({
      nearbyRetailers: enrichment.retailers as any,
      propertyLat: enrichment.lat.toFixed(7) as any,
      propertyLng: enrichment.lng.toFixed(7) as any,
      updatedAt: new Date(),
    })
    .where(eq(costarReports.id, reportId))

  // ── Step 3: Re-grade with enriched data ───────────────────────
  const weightsRow = await db.query.gradeWeights.findFirst({
    where: eq(gradeWeights.orgId, dbUser.organization.id),
  })
  const baseWeights: CostarGradeWeights = weightsRow
    ? {
        traffic: Number(weightsRow.traffic),
        consumerSpend: Number(weightsRow.consumerSpend),
        householdIncome: Number(weightsRow.householdIncome),
        demographics: Number(weightsRow.demographics),
        anchorTenant: Number(weightsRow.anchorTenant),
      }
    : DEFAULT_GRADE_WEIGHTS

  const trafficScore        = scoreTraffic(report.trafficCounts ?? [])
  const consumerSpendScore  = scoreConsumerSpend(report.consumerSpend?.threeMile)
  const householdIncScore   = scoreHouseholdIncome(report.demographics?.threeMile)
  const demographicsScore   = scoreDemographics(report.demographics?.threeMile)
  const { score: anchorScore, anchors } = scoreAnchorTenants(enrichment.retailers)

  // If Places found nothing, exclude anchor from overall rather than penalize
  const effectiveWeights = enrichment.retailers.length === 0
    ? redistributeWeightsExcluding('anchorTenant', baseWeights)
    : baseWeights

  const overallScore = computeOverallScore(
    { traffic: trafficScore, consumerSpend: consumerSpendScore,
      householdIncome: householdIncScore, demographics: demographicsScore,
      anchorTenant: anchorScore },
    effectiveWeights
  )

  const overallGrade         = scoreToGrade(overallScore)
  const anchorTenantGrade    = enrichment.retailers.length === 0
    ? 'N/A'
    : scoreToGrade(anchorScore)

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
      demographics: report.demographics?.threeMile ?? null,
      trafficCounts: report.trafficCounts ?? [],
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), { reportId })
  }

  const [grade] = await db.insert(propertyGrades).values({
    orgId: dbUser.organization.id,
    userId: dbUser.id,
    costarReportId: reportId,
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
    anchorTenantGrade: anchorTenantGrade as any,
    anchorTenants: anchors as any,
    aiSummary: narrative?.summary ?? null,
    aiStrengths: narrative?.strengths ?? null,
    aiRisks: narrative?.risks ?? null,
    aiRecommendation: narrative?.recommendation ?? null,
    weightsSnapshot: effectiveWeights as any,
  }).returning()

  return NextResponse.json({
    gradeId: grade.id,
    placesFound: enrichment.retailers.length,
    retailers: enrichment.retailers.map((r) => ({
      name: r.name,
      category: r.category,
      distanceMiles: r.distanceMiles,
    })),
    coords: { lat: enrichment.lat, lng: enrichment.lng },
  })
}
