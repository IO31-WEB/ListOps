/**
 * POST /api/commercial/grade
 *
 * Runs the grading engine on a parsed CoStar report and persists the grade.
 * Accepts either a reportId (use existing parsed data) or inline data payload
 * (for CoStar API push path).
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
import { desc } from 'drizzle-orm';
import { z } from 'zod'
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
import type { PlanTier, } from '@/lib/plans'
import type { CostarGradeWeights } from '@/lib/db/schema'

export const runtime = 'nodejs'
export const maxDuration = 60

const RequestSchema = z.object({
  reportId: z.string().uuid(),
  regenerate: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await rateLimitAPI(request.headers.get('x-forwarded-for') ?? userId)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
  }

  const { reportId, regenerate } = parsed.data

  const dbUser = await getUserWithDetails(userId)
  if (!dbUser?.organization) {
    return NextResponse.json({ error: 'User or organization not found' }, { status: 404 })
  }

  const sub = dbUser.organization.subscriptions?.[0]
  const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
  if (!canAccess(plan, 'property_grading')) {
    return NextResponse.json(
      { error: 'Property grading requires the Commercial plan or higher.' },
      { status: 403 }
    )
  }

  // Fetch the CoStar report — scoped to org for security
  const report = await db.query.costarReports.findFirst({
    where: and(
      eq(costarReports.id, reportId),
      eq(costarReports.orgId, dbUser.organization.id)
    ),
  })

  if (!report) {
    return NextResponse.json({ error: 'CoStar report not found' }, { status: 404 })
  }

  if (report.parseError) {
    return NextResponse.json(
      { error: 'Cannot grade a report with parse errors. Re-upload the PDF.' },
      { status: 422 }
    )
  }

  // Return existing grade unless regenerate=true
  if (!regenerate) {
    const existing = await db.query.propertyGrades.findFirst({
      where: eq(propertyGrades.costarReportId, reportId),
      orderBy: [desc(propertyGrades.createdAt)],
    })
    if (existing) {
      return NextResponse.json({ gradeId: existing.id, cached: true })
    }
  }

  // Load org-specific weights or use defaults
  const weightsRow = await db.query.gradeWeights.findFirst({
    where: eq(gradeWeights.orgId, dbUser.organization.id),
  })

  const weights: CostarGradeWeights = weightsRow
    ? {
        traffic: Number(weightsRow.traffic),
        consumerSpend: Number(weightsRow.consumerSpend),
        householdIncome: Number(weightsRow.householdIncome),
        demographics: Number(weightsRow.demographics),
        anchorTenant: Number(weightsRow.anchorTenant),
      }
    : DEFAULT_GRADE_WEIGHTS

  // Run scoring
  const trafficScore = scoreTraffic(report.trafficCounts ?? [])
  const consumerSpendScore = scoreConsumerSpend(report.consumerSpend?.threeMile)
  const householdIncomeScore = scoreHouseholdIncome(report.demographics?.threeMile)
  const demographicsScore = scoreDemographics(report.demographics?.threeMile)
  const { score: anchorTenantScore, hasData: anchorHasData, anchors } = scoreAnchorTenants(report.nearbyRetailers ?? [])

  // When anchor tenant data is missing, exclude it from the weighted average
  // rather than penalizing the score for a data gap
  const effectiveWeights = anchorHasData
    ? weights
    : redistributeWeightsExcluding('anchorTenant', weights)

  const overallScore = computeOverallScore(
    { traffic: trafficScore, consumerSpend: consumerSpendScore, householdIncome: householdIncomeScore, demographics: demographicsScore, anchorTenant: anchorTenantScore },
    effectiveWeights
  )

  const overallGrade = scoreToGrade(overallScore)
  const trafficGrade = scoreToGrade(trafficScore)
  const consumerSpendGrade = scoreToGrade(consumerSpendScore)
  const householdIncomeGrade = scoreToGrade(householdIncomeScore)
  const demographicsGrade = scoreToGrade(demographicsScore)
  const anchorTenantGrade = anchorHasData ? scoreToGrade(anchorTenantScore) : 'F'

  // Generate AI narrative
  let narrative
  try {
    narrative = await generateGradeNarrative({
      address: report.propertyAddress,
      overallGrade,
      overallScore,
      trafficScore,
      consumerSpendScore,
      householdIncomeScore,
      demographicsScore,
      anchorTenantScore,
      anchors,
      demographics: report.demographics?.threeMile ?? null,
      trafficCounts: report.trafficCounts ?? [],
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), { reportId })
    narrative = null
  }

  const [grade] = await db
    .insert(propertyGrades)
    .values({
      orgId: dbUser.organization.id,
      userId: dbUser.id,
      costarReportId: reportId,
      overallGrade: overallGrade as any,
      overallScore: overallScore.toFixed(2),
      trafficScore: trafficScore.toFixed(2),
      trafficGrade: trafficGrade as any,
      consumerSpendScore: consumerSpendScore.toFixed(2),
      consumerSpendGrade: consumerSpendGrade as any,
      householdIncomeScore: householdIncomeScore.toFixed(2),
      householdIncomeGrade: householdIncomeGrade as any,
      demographicsScore: demographicsScore.toFixed(2),
      demographicsGrade: demographicsGrade as any,
      anchorTenantScore: anchorTenantScore.toFixed(2),
      anchorTenantGrade: anchorTenantGrade as any,
      anchorTenants: anchors as any,
      aiSummary: narrative?.summary ?? null,
      aiStrengths: narrative?.strengths ?? null,
      aiRisks: narrative?.risks ?? null,
      aiRecommendation: narrative?.recommendation ?? null,
      weightsSnapshot: effectiveWeights as any,
    })
    .returning()

  return NextResponse.json({ gradeId: grade.id, cached: false })
}
