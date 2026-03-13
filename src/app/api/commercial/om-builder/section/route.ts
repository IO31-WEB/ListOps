// Regenerates a single OM section without rebuilding the entire document.

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { siteReports, propertyGrades } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserPlan } from '@/lib/user-service'

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

    const plan = await getUserPlan(userId)
    if (plan.tier !== 'commercial') {
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
      .where(and(eq(siteReports.id, reportId), eq(siteReports.userId, userId)))
      .limit(1)

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const [grade] = await db
      .select()
      .from(propertyGrades)
      .where(eq(propertyGrades.reportId, reportId))
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


// ═════════════════════════════════════════════════════════════════════════════
//  FILE PLACEMENT GUIDE
//  Drop these files into your Next.js src/app directory:
// ═════════════════════════════════════════════════════════════════════════════
//
//  PAGES (replace existing):
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │  src/app/dashboard/commercial/page.tsx          ← commercial-page.tsx   │
//  └─────────────────────────────────────────────────────────────────────────┘
//
//  NEW API ROUTES (create directories + drop in route.ts):
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │  src/app/api/commercial/om-builder/route.ts     ← api-om-builder-route  │
//  │  src/app/api/commercial/om-builder/section/     ← (this file)           │
//  │    └── route.ts                                                          │
//  │  src/app/api/commercial/om-builder/pdf/         ← wire to existing PDF  │
//  │    └── route.ts                                   generation util        │
//  │  src/app/api/commercial/email-campaign/route.ts ← api-email-campaign    │
//  │  src/app/api/commercial/email-campaign/send/    ← api-email-send-route  │
//  │    └── route.ts                                                          │
//  │  src/app/api/commercial/teaser/route.ts         ← api-teaser-comps      │
//  │  src/app/api/commercial/comps/route.ts          ← api-teaser-comps      │
//  │    (POST_COMPS export → rename to POST)                                  │
//  │  src/app/api/commercial/microsite/route.ts      ← api-microsite-route   │
//  └─────────────────────────────────────────────────────────────────────────┘
//
//  SCHEMA NOTE:
//  The microsite route references a `siteReportId` FK and `type` column on
//  your microsites table. Add a migration if those columns don't exist yet:
//
//    ALTER TABLE microsites ADD COLUMN site_report_id TEXT REFERENCES site_reports(id);
//    ALTER TABLE microsites ADD COLUMN type TEXT NOT NULL DEFAULT 'residential';
//
//  ENV VARS NEEDED (add to .env.local):
//    RESEND_API_KEY=re_...
//    RESEND_FROM_EMAIL=campaigns@yourdomain.com   (must be verified in Resend)
