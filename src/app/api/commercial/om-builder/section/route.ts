import { INJECTION_GUARD, sanitizeForPrompt } from '@/lib/prompt-safety'
import { auth } from '@clerk/nextjs/server'
import { OmSectionBody } from '@/lib/commercial-schemas'
import { guardAi } from '@/lib/ai-guard'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { COMMERCIAL_MODEL, getText } from '@/lib/claude'
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
    const aiBlocked = await guardAi(userId, 'om-builder-section')
    if (aiBlocked) return aiBlocked

    const dbUser = await getUserWithDetails(userId)
    if (!dbUser?.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    const sub = dbUser.organization.subscriptions?.[0]
    const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
    if (!canAccess(plan, 'site_analysis')) {
      return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
    }

    const parsed = OmSectionBody.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { reportId, section, propertyType, askingPrice, capRate } = parsed.data

    const prompt = Object.prototype.hasOwnProperty.call(SECTION_PROMPTS, section) ? SECTION_PROMPTS[section] : undefined
    if (!prompt) {
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 })
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
      `Property: ${sanitizeForPrompt(report.propertyAddress, 160)}${report.propertyCity ? `, ${sanitizeForPrompt(report.propertyCity, 80)}` : ''}${report.propertyState ? `, ${sanitizeForPrompt(report.propertyState, 4)}` : ''}`,
      `Property Type: ${sanitizeForPrompt(propertyType ?? 'Commercial', 80)}`,
      ...(askingPrice ? [`Asking Price: ${sanitizeForPrompt(askingPrice, 80)}`] : []),
      ...(capRate ? [`Cap Rate: ${sanitizeForPrompt(capRate, 80)}`] : []),
      `Overall Grade: ${grade.overallGrade} (score: ${grade.overallScore}/100)`,
      ...(grade.aiSummary ? [`AI Summary: ${grade.aiSummary}`] : []),
      ...(Array.isArray(grade.aiStrengths) ? [`Strengths: ${(grade.aiStrengths as string[]).join('; ')}`] : []),
      ...(Array.isArray(grade.aiRisks) ? [`Risk Flags: ${(grade.aiRisks as string[]).join('; ')}`] : []),
    ]

    const msg = await anthropic.messages.create({
      model: COMMERCIAL_MODEL,
      system: INJECTION_GUARD,
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

    const content = getText(msg, 'om-builder-section').trim()
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[om-builder/section]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
