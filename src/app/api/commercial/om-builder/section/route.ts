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
  executiveSummary: `Write a compelling executive summary for a commercial real estate Offering Memorandum. 2–3 paragraphs. Tone: professional, confident, investment-grade. Lead with the opportunity, include grade context, key demand drivers, and a punchy closing sentence.`,
  propertyOverview: `Write the Property Overview section. Cover: location, property type, site characteristics, visibility, access, and market context. 2–3 paragraphs, factual and broker-professional in tone.`,
  financialHighlights: `Write the Financial Highlights section. If asking price or cap rate are provided, lead with those. Otherwise reference income potential from the demographics/traffic data. Include consumer spend density, household income. Use "$X" format. 1–2 paragraphs.`,
  marketAnalysis: `Write a Market Analysis section. Draw on demographic and traffic data to characterize the trade area. Describe growth trends, income profile, and competitive positioning. 2–3 paragraphs. Investment-grade language.`,
  demographicsInsights: `Write the Demographics & Traffic Insights section. Reference specific numbers. Frame each stat as a demand driver. Professional narrative style, not bullet points.`,
  investmentHighlights: `Write the Investment Highlights section — the persuasive closer. 3–5 bold-keyword paragraphs (e.g., "**Prime Visibility:**"). Draw on strengths from grade data. End with a CTA sentence.`,
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

    const { reportId, section, propertyType, askingPrice, capRate } = await req.json()

    if (!reportId || !section) {
      return NextResponse.json({ error: 'reportId and section required' }, { status: 400 })
    }

    const prompt = SECTION_PROMPTS[section]
    if (!prompt) {
      return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 })
    }

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

    if (!grade) return NextResponse.json({ error: 'Grade required' }, { status: 400 })

    const contextLines = [
      `Property: ${report.propertyAddress}${report.propertyCity ? `, ${report.propertyCity}` : ''}${report.propertyState ? `, ${report.propertyState}` : ''}`,
      `Property Type: ${propertyType ?? 'Commercial'}`,
      ...(askingPrice ? [`Asking Price: ${askingPrice}`] : []),
      ...(capRate ? [`Cap Rate: ${capRate}`] : []),
      `Overall Grade: ${grade.overallGrade} (score: ${grade.overallScore}/100)`,
      ...(grade.aiSummary ? [`AI Summary: ${grade.aiSummary}`] : []),
      ...(Array.isArray(grade.aiStrengths) ? [`Strengths: ${(grade.aiStrengths as string[]).join('; ')}`] : []),
      ...(Array.isArray(grade.aiRisks) ? [`Risk Flags: ${(grade.aiRisks as string[]).join('; ')}`] : []),
    ]

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are writing a section of a commercial real estate Offering Memorandum.

PROPERTY DATA:
${contextLines.join('\n')}

TASK: ${prompt}

Output ONLY the section text — no labels, no markdown headers, no preamble.`,
      }],
    })

    const content = (msg.content[0] as { type: string; text: string }).text.trim()
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[om-builder/section]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
