import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { siteReports, propertyGrades } from '@/lib/db/schema'
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
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `Generate a commercial real estate investment teaser / one-pager from this property data.

PROPERTY DATA:
${context}

Output ONLY valid JSON (no markdown fences), matching this exact shape:
{
  "headline": "...",
  "keyStats": [
    { "label": "...", "value": "..." },
    { "label": "...", "value": "..." },
    { "label": "...", "value": "..." }
  ],
  "description": "...",
  "cta": "..."
}

Rules:
- headline: 8–12 words, benefit-led, city/market specific, investment angle
- keyStats: exactly 3 items using the most impactful numbers from the data (traffic ADT, income, pop growth, grade score, spend, etc.)
- description: 2–3 sentences. Punchy, professional, specific to this property's trade area strengths
- cta: 1 sentence action prompt. Example: "Contact listing broker for grade card and full OM."`,
      }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const teaserData = JSON.parse(clean)

    return NextResponse.json(teaserData)
  } catch (err) {
    console.error('[teaser]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function buildContext(report: Record<string, unknown>, grade: Record<string, unknown>): string {
  const lines = [
    `Property: ${report.propertyAddress}${report.propertyCity ? `, ${report.propertyCity}` : ''}${report.propertyState ? `, ${report.propertyState}` : ''}`,
    `Overall Grade: ${grade.overallGrade} (score: ${grade.overallScore}/100)`,
    `Traffic Grade: ${grade.trafficGrade}`,
    `Consumer Spend Grade: ${grade.consumerSpendGrade}`,
    `Income Grade: ${grade.householdIncomeGrade}`,
  ]

  const demo = report.demographics as Record<string, unknown> | null
  const d = demo?.threeMile as Record<string, number> | null
  if (d) {
    lines.push(`Population (3mi): ${d.population2024?.toLocaleString()}`)
    lines.push(`5-yr Pop Growth: ${d.populationGrowth5yr?.toFixed(1)}%`)
    lines.push(`Median HH Income: $${d.medianHouseholdIncome?.toLocaleString()}`)
    lines.push(`Avg HH Income: $${d.avgHouseholdIncome?.toLocaleString()}`)
  }

  const traffic = report.trafficCounts as Array<{ street: string; avgDailyVolume: number }> | null
  if (traffic?.length) {
    const top = traffic.reduce((a, b) => a.avgDailyVolume > b.avgDailyVolume ? a : b)
    lines.push(`Peak Traffic: ${top.avgDailyVolume.toLocaleString()} ADT on ${top.street}`)
  }

  const spend = (report.consumerSpend as Record<string, unknown> | null)?.threeMile as Record<string, number> | null
  if (spend?.totalSpecified) lines.push(`3-Mi Consumer Spend: $${spend.totalSpecified.toLocaleString()}`)

  if (Array.isArray(grade.aiStrengths)) lines.push(`Strengths: ${(grade.aiStrengths as string[]).join('; ')}`)

  return lines.join('\n')
}
