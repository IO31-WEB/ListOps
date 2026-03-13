import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { siteReports, propertyGrades } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserPlan } from '@/lib/user-service'

const anthropic = new Anthropic()

interface EmailDraft {
  subject: string
  body: string
  sendDay: number
}

const SEQUENCE_CONFIGS = {
  investor: [
    { day: 0, role: 'Teaser / first touch', focus: 'Lead with the grade and primary traffic/income stat. Subject line should be intriguing, not salesy. Keep body under 120 words. End with a soft CTA: "Reply for details."' },
    { day: 3, role: 'Key stats follow-up', focus: 'Share 3 specific numbers from the demographics/traffic data framed as investor demand indicators. Mention cap rate context if available. 100–130 words. CTA: "Happy to send the full site analysis."' },
    { day: 7, role: 'Market context', focus: 'Zoom out — describe the trade area growth story and what it means for long-term value. Reference 5-yr population growth and income trajectory. 110–140 words. CTA: request a call.' },
    { day: 14, role: 'Mini-OM attachment teaser', focus: 'Reference that you\'re attaching (or can share) the full site grade card and offering summary. Create urgency with market timing. 80–100 words. CTA: "Want me to send the full OM?"' },
    { day: 21, role: 'Final follow-up / close', focus: 'Light, no-pressure close. Acknowledge they\'re busy. Offer to answer one question or share a specific data point. 60–80 words. CTA: one-question format.' },
  ],
  tenant: [
    { day: 0, role: 'Site introduction', focus: 'Lead with traffic count and co-tenancy. Frame for a retailer evaluating a new location. Subject: site-specific and metrics-driven. Under 130 words. CTA: "Would this fit your target demo?"' },
    { day: 3, role: 'Demographics deep-dive', focus: 'Highlight the consumer profile — income, age, spending patterns from the data. Match to typical tenant targeting criteria. 100–130 words. CTA: offer to share full demographics.' },
    { day: 7, role: 'Co-tenancy & visibility', focus: 'Describe anchor tenant context and site visibility/access advantages implied by the traffic data. 100–120 words. CTA: suggest a site visit.' },
    { day: 14, role: 'Competitive positioning', focus: 'Address why this site beats alternatives — trade area exclusivity, underserved categories, or growth trajectory. 90–110 words. CTA: "Can I set up a call with the broker?"' },
    { day: 21, role: 'Last touch', focus: 'Low-pressure follow-up referencing a specific data point they haven\'t heard yet. Keep it to 70 words max. CTA: one direct question.' },
  ],
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const plan = await getUserPlan(userId)
    if (plan.tier !== 'commercial') {
      return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
    }

    const { reportId, campaignType } = await req.json()
    if (!reportId || !campaignType) {
      return NextResponse.json({ error: 'reportId and campaignType required' }, { status: 400 })
    }

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

    const context = buildContext(report, grade)
    const configs = SEQUENCE_CONFIGS[campaignType as keyof typeof SEQUENCE_CONFIGS] ?? SEQUENCE_CONFIGS.investor

    // Generate all 5 emails in parallel
    const sequence = await Promise.all(
      configs.map(config => generateEmail(config, context, campaignType))
    )

    return NextResponse.json({ sequence })
  } catch (err) {
    console.error('[email-campaign]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function generateEmail(
  config: { day: number; role: string; focus: string },
  context: string,
  campaignType: string
): Promise<EmailDraft> {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are a commercial real estate broker writing a prospect outreach email.

PROPERTY CONTEXT:
${context}

CAMPAIGN TYPE: ${campaignType === 'investor' ? 'Investor outreach (focus: cap rates, NOI, returns, market position)' : 'Tenant prospecting (focus: traffic, co-tenancy, demographics, site fit)'}

EMAIL ROLE: ${config.role}
SEND DAY: Day ${config.day}
FOCUS & CONSTRAINTS: ${config.focus}

Respond with ONLY valid JSON (no markdown), matching this shape exactly:
{
  "subject": "...",
  "body": "...",
  "sendDay": ${config.day}
}

The body should be plain text (no markdown), natural broker voice, personalized with specific data points. Do not use the recipient's name (it's a template). Sign off as "Best, [Your Name]".`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(clean) as EmailDraft
}

function buildContext(report: Record<string, unknown>, grade: Record<string, unknown>): string {
  const lines: string[] = [
    `Property: ${report.propertyAddress}${report.propertyCity ? `, ${report.propertyCity}` : ''}${report.propertyState ? `, ${report.propertyState}` : ''}`,
    `Overall Grade: ${grade.overallGrade} (score: ${grade.overallScore}/100)`,
  ]

  const demo = report.demographics as Record<string, unknown> | null
  const threeMile = demo?.threeMile as Record<string, number> | null
  if (threeMile) {
    lines.push(`3-Mile Population: ${threeMile.population2024?.toLocaleString()}`)
    lines.push(`5-yr Population Growth: ${threeMile.populationGrowth5yr?.toFixed(1)}%`)
    lines.push(`Median HH Income: $${threeMile.medianHouseholdIncome?.toLocaleString()}`)
    lines.push(`Avg HH Income: $${threeMile.avgHouseholdIncome?.toLocaleString()}`)
    lines.push(`Median Age: ${threeMile.medianAge?.toFixed(1)}`)
  }

  const traffic = report.trafficCounts as Array<{ street: string; avgDailyVolume: number; distanceMiles: number }> | null
  if (traffic && traffic.length > 0) {
    const top = traffic.reduce((a, b) => a.avgDailyVolume > b.avgDailyVolume ? a : b)
    lines.push(`Peak Traffic: ${top.avgDailyVolume.toLocaleString()} ADT on ${top.street}`)
  }

  const spend = report.consumerSpend as Record<string, unknown> | null
  const spendData = spend?.threeMile as Record<string, number> | null
  if (spendData?.totalSpecified) {
    lines.push(`3-Mile Consumer Spend: $${spendData.totalSpecified.toLocaleString()}`)
  }

  if (Array.isArray(grade.aiStrengths) && grade.aiStrengths.length) {
    lines.push(`Key Strengths: ${(grade.aiStrengths as string[]).join('; ')}`)
  }

  return lines.join('\n')
}
