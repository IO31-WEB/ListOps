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

const SECTION_PROMPTS: Record<string, string> = {
  executiveSummary: `Write a compelling executive summary for a commercial real estate Offering Memorandum.
2–3 paragraphs. Tone: professional, confident, investment-grade.
Lead with the opportunity, include grade context, key demand drivers, and a punchy closing sentence.`,

  propertyOverview: `Write the Property Overview section for a commercial OM.
Cover: location, property type, site characteristics implied by the data, visibility, access, and market context.
2–3 paragraphs, factual and broker-professional in tone.`,

  financialHighlights: `Write the Financial Highlights section.
If asking price and/or cap rate are provided, lead with those. Otherwise, reference the income potential supported by the demographics and traffic data.
Include: consumer spend density, household income, any revenue-supporting metrics from the data.
Use "$X" format for dollar figures. 1–2 paragraphs.`,

  marketAnalysis: `Write a Market Analysis section for a commercial OM.
Draw on the demographic and traffic data to characterize the trade area. Describe growth trends, income profile, daytime population if implied, and competitive positioning.
2–3 paragraphs. Investment-grade language.`,

  demographicsInsights: `Write the Demographics & Traffic Insights section.
Reference specific numbers from the data (population, income, growth rate, traffic counts).
Frame each stat as a demand driver — explain why it matters to an investor or tenant.
Use a professional narrative style, not bullet points.`,

  investmentHighlights: `Write the Investment Highlights section — the persuasive closer.
3–5 crisp bullet-style paragraphs (each starting with a bold keyword like "**Prime Visibility:**").
Draw on strengths from the grade card, traffic data, and income demographics.
End with a call-to-action sentence.`,
}

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

    const { reportId, propertyType, askingPrice, capRate } = await req.json()
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

    // Build shared context for all sections
    const context = buildContext(report, grade, { propertyType, askingPrice, capRate })

    // Generate all 6 sections in parallel
    const sectionKeys = Object.keys(SECTION_PROMPTS)
    const results = await Promise.all(
      sectionKeys.map(key =>
        generateSection(key, SECTION_PROMPTS[key], context)
      )
    )

    const sections: Record<string, string> = {}
    sectionKeys.forEach((key, i) => { sections[key] = results[i] })

    return NextResponse.json({ sections })
  } catch (err) {
    console.error('[om-builder]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function generateSection(
  sectionKey: string,
  instruction: string,
  context: string
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are writing a section of a professional commercial real estate Offering Memorandum.

PROPERTY DATA:
${context}

TASK: ${instruction}

Output ONLY the section text — no labels, no markdown headers, no preamble. Write as if this is flowing body text in a PDF document.`,
    }],
  })
  return (msg.content[0] as { type: string; text: string }).text.trim()
}

function buildContext(
  report: Record<string, unknown>,
  grade: Record<string, unknown>,
  meta: { propertyType?: string; askingPrice?: string; capRate?: string }
): string {
  const lines: string[] = [
    `Property: ${report.propertyAddress}${report.propertyCity ? `, ${report.propertyCity}` : ''}${report.propertyState ? `, ${report.propertyState}` : ''}`,
    `Property Type: ${meta.propertyType ?? 'Commercial'}`,
    ...(meta.askingPrice ? [`Asking Price: ${meta.askingPrice}`] : []),
    ...(meta.capRate ? [`Cap Rate: ${meta.capRate}`] : []),
    `Overall Grade: ${grade.overallGrade} (score: ${grade.overallScore}/100)`,
    `Traffic Grade: ${grade.trafficGrade} (score: ${grade.trafficScore})`,
    `Consumer Spend Grade: ${grade.consumerSpendGrade} (score: ${grade.consumerSpendScore})`,
    `Household Income Grade: ${grade.householdIncomeGrade} (score: ${grade.householdIncomeScore})`,
    `Demographics Grade: ${grade.demographicsGrade} (score: ${grade.demographicsScore})`,
    ...(grade.aiSummary ? [`AI Summary: ${grade.aiSummary}`] : []),
    ...(Array.isArray(grade.aiStrengths) && grade.aiStrengths.length
      ? [`Strengths: ${(grade.aiStrengths as string[]).join('; ')}`]
      : []),
    ...(Array.isArray(grade.aiRisks) && grade.aiRisks.length
      ? [`Risk Flags: ${(grade.aiRisks as string[]).join('; ')}`]
      : []),
  ]

  // Demographics
  const demo = report.demographics as Record<string, unknown> | null
  const threeMile = demo?.threeMile as Record<string, number> | null
  if (threeMile) {
    lines.push(`3-Mile Population: ${threeMile.population2024?.toLocaleString()}`)
    lines.push(`5-yr Population Growth: ${threeMile.populationGrowth5yr?.toFixed(1)}%`)
    lines.push(`Median HH Income: $${threeMile.medianHouseholdIncome?.toLocaleString()}`)
    lines.push(`Avg HH Income: $${threeMile.avgHouseholdIncome?.toLocaleString()}`)
    lines.push(`Median Age: ${threeMile.medianAge?.toFixed(1)}`)
    lines.push(`College-Educated: ${threeMile.bachelorsPlusPct?.toFixed(1)}%`)
  }

  // Traffic
  const traffic = report.trafficCounts as Array<{ street: string; avgDailyVolume: number; distanceMiles: number }> | null
  if (traffic && traffic.length > 0) {
    const topCount = traffic.reduce((a, b) => a.avgDailyVolume > b.avgDailyVolume ? a : b)
    lines.push(`Peak Traffic: ${topCount.avgDailyVolume.toLocaleString()} ADT on ${topCount.street} (${topCount.distanceMiles} mi)`)
  }

  // Consumer spend
  const spend = report.consumerSpend as Record<string, unknown> | null
  const threeMileSpend = spend?.threeMile as Record<string, number> | null
  if (threeMileSpend?.totalSpecified) {
    lines.push(`3-Mile Consumer Spend: $${threeMileSpend.totalSpecified.toLocaleString()}`)
  }

  return lines.join('\n')
}
