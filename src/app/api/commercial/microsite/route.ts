import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { siteReports, propertyGrades, microsites } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserPlan } from '@/lib/user-service'
import { nanoid } from 'nanoid'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const plan = await getUserPlan(userId)
    if (plan.tier !== 'commercial') {
      return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
    }

    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    const [report] = await db
      .select()
      .from(siteReports)
      .where(and(eq(siteReports.id, reportId), eq(siteReports.userId, userId)))
      .limit(1)

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const [grade] = await db
      .select()
      .from(propertyGrades)
      .where(eq(propertyGrades.reportId, reportId))
      .limit(1)

    if (!grade) return NextResponse.json({ error: 'Grade this report first' }, { status: 400 })

    // Generate CRE-specific microsite copy
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
- headline: 6–10 words, specific to this market, investment angle
- tagline: 4–8 words, benefit-focused, punchy
- description: 3–4 sentences. Professional, investment-grade. Specific to this property's data.
- investmentHighlights: exactly 5 bullet strings, each starting with a strong keyword followed by a colon (e.g., "Prime Traffic Exposure: ...")
- demographicsNarrative: 2 sentences summarizing the trade area consumer profile
- trafficNarrative: 1–2 sentences on traffic/visibility as a business driver`,
      }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const copy = JSON.parse(clean)

    // Create the microsite record
    // NOTE: This assumes a 'microsites' table with a type/variant column for 'commercial'
    // Adapt the insert columns to match your actual schema.
    const slug = `cre-${nanoid(8)}`

    await db.insert(microsites).values({
      id: nanoid(),
      userId,
      siteReportId: reportId,         // FK to siteReports
      slug,
      type: 'commercial',              // flag for the /l/[slug] page to render CRE template
      published: true,
      content: JSON.stringify({
        ...copy,
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
      }),
      createdAt: new Date(),
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
