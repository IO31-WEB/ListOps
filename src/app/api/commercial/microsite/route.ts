import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { siteReports, propertyGrades, campaigns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dbUser = await getUserWithDetails(userId)
    if (!dbUser?.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    const sub = dbUser.organization.subscriptions?.[0]
    const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
    if (!canAccess(plan, 'site_analysis')) {
      return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
    }

    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    const [report] = await db
      .select()
      .from(siteReports)
      .where(and(eq(siteReports.id, reportId), eq(siteReports.userId, dbUser.id)))
      .limit(1)

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const [grade] = await db
      .select()
      .from(propertyGrades)
      .where(eq(propertyGrades.siteReportId, reportId))
      .limit(1)

    if (!grade) return NextResponse.json({ error: 'Grade this report first' }, { status: 400 })

    const context = buildContext(report, grade)

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Generate content for a commercial real estate listing microsite.

PROPERTY DATA:
${context}

Output ONLY valid JSON (no markdown), matching this exact shape:
{
  "headline": "...",
  "tagline": "...",
  "description": "...",
  "investmentHighlights": ["...", "...", "...", "...", "..."],
  "demographicsNarrative": "...",
  "trafficNarrative": "..."
}

Rules:
- headline: 6-10 words, specific to this market, investment angle
- tagline: 4-8 words, benefit-focused, punchy
- description: 3-4 sentences. Professional, investment-grade. Specific to this property data.
- investmentHighlights: exactly 5 bullet strings, each starting with a strong keyword followed by a colon
- demographicsNarrative: 2 sentences summarizing the trade area consumer profile
- trafficNarrative: 1-2 sentences on traffic/visibility as a business driver`,
      }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const copy = JSON.parse(clean)

    // Store as a campaign row so the existing /l/[slug] route renders it.
    // CRE content lives in analytics.micrositeCopy.
    const slug = `cre-${reportId.slice(0, 8)}-${Date.now().toString(36)}`

    await db.insert(campaigns).values({
      agentId: dbUser.id,
      orgId: dbUser.organization.id,
      status: 'complete',
      micrositeSlug: slug,
      micrositePublished: true,
      analytics: {
        micrositeCopy: {
          ...copy,
          _type: 'commercial',
          grade: {
            overallGrade: grade.overallGrade,
            overallScore: grade.overallScore,
            trafficGrade: grade.trafficGrade,
            consumerSpendGrade: grade.consumerSpendGrade,
            householdIncomeGrade: grade.householdIncomeGrade,
            demographicsGrade: grade.demographicsGrade,
            aiSummary: grade.aiSummary,
            aiStrengths: grade.aiStrengths,
            aiRisks: grade.aiRisks,
          },
          property: {
            address: report.propertyAddress,
            city: report.propertyCity,
            state: report.propertyState,
            zip: report.propertyZip,
          },
          demographics: report.demographics,
          trafficCounts: report.trafficCounts,
          consumerSpend: report.consumerSpend,
        },
      } as any,
    })

    return NextResponse.json({ slug })
  } catch (err) {
    console.error('[commercial/microsite]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function buildContext(report: Record<string, unknown>, grade: Record<string, unknown>): string {
  const lines = [
    `Property: ${report.propertyAddress}${report.propertyCity ? `, ${report.propertyCity}` : ''}${report.propertyState ? `, ${report.propertyState}` : ''}`,
    `Overall Grade: ${grade.overallGrade} (${grade.overallScore}/100)`,
    `Traffic Grade: ${grade.trafficGrade}`,
    `Income Grade: ${grade.householdIncomeGrade}`,
    `Consumer Spend Grade: ${grade.consumerSpendGrade}`,
  ]

  const demo = report.demographics as Record<string, unknown> | null
  const d = demo?.threeMile as Record<string, number> | null
  if (d) {
    lines.push(`Population (3mi): ${d.population2024?.toLocaleString()}`)
    lines.push(`Median HH Income: $${d.medianHouseholdIncome?.toLocaleString()}`)
    lines.push(`5-yr Pop Growth: ${d.populationGrowth5yr?.toFixed(1)}%`)
  }

  const traffic = report.trafficCounts as Array<{ street: string; avgDailyVolume: number }> | null
  if (traffic?.length) {
    const top = traffic.reduce((a, b) => a.avgDailyVolume > b.avgDailyVolume ? a : b)
    lines.push(`Peak Traffic: ${top.avgDailyVolume.toLocaleString()} ADT on ${top.street}`)
  }

  if (Array.isArray(grade.aiStrengths)) {
    lines.push(`Strengths: ${(grade.aiStrengths as string[]).join('; ')}`)
  }

  return lines.join('\n')
}
