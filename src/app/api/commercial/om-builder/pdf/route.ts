import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'

// ── Design tokens ────────────────────────────────────────────────
const COLORS = {
  ink:       rgb(0.059, 0.090, 0.161),  // slate-900  #0f172a
  slate600:  rgb(0.278, 0.333, 0.408),  // slate-600
  slate400:  rgb(0.576, 0.635, 0.702),  // slate-400
  amber:     rgb(0.961, 0.620, 0.043),  // amber-500  #f59e0b
  white:     rgb(1, 1, 1),
  cream:     rgb(0.996, 0.976, 0.941),  // --cream
  rule:      rgb(0.882, 0.898, 0.918),  // slate-200
}

const MARGIN = 56          // pts (approx 0.78 in)
const PAGE_W = 612         // Letter width
const PAGE_H = 792         // Letter height
const CONTENT_W = PAGE_W - MARGIN * 2

const SECTION_LABELS: Record<string, string> = {
  executiveSummary:    'Executive Summary',
  propertyOverview:    'Property Overview',
  financialHighlights: 'Financial Highlights',
  marketAnalysis:      'Market Analysis',
  demographicsInsights:'Demographics & Traffic',
  investmentHighlights:'Investment Highlights',
}

const SECTION_ORDER = [
  'executiveSummary',
  'propertyOverview',
  'financialHighlights',
  'marketAnalysis',
  'demographicsInsights',
  'investmentHighlights',
]

// ── Route handler ────────────────────────────────────────────────

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

    const { sections, propertyType, askingPrice, capRate, reportId } = await req.json() as {
      sections: Record<string, string>
      propertyType?: string
      askingPrice?: string
      capRate?: string
      reportId?: string
    }

    if (!sections || Object.keys(sections).length === 0) {
      return NextResponse.json({ error: 'sections required' }, { status: 400 })
    }

    const pdfBytes = await buildOM({ sections, propertyType, askingPrice, capRate });

    const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });

return new NextResponse(pdfBlob, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="offering-memorandum.pdf"',
    'Content-Length': pdfBytes.length.toString(),  // still safe on original
  },
});
});
  } catch (err) {
    console.error('[om-builder/pdf]', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}

// ── PDF builder ──────────────────────────────────────────────────

async function buildOM(opts: {
  sections: Record<string, string>
  propertyType?: string
  askingPrice?: string
  capRate?: string
}): Promise<Uint8Array> {
  const { sections, propertyType, askingPrice, capRate } = opts

  const doc = await PDFDocument.create()
  doc.setTitle('Offering Memorandum')
  doc.setAuthor('ListOps Commercial')
  doc.setCreator('ListOps')

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold    = await doc.embedFont(StandardFonts.HelveticaBold)

  // ── Cover page ─────────────────────────────────────────────────
  const cover = doc.addPage([PAGE_W, PAGE_H])
  drawCover(cover, { fontRegular, fontBold, propertyType, askingPrice, capRate })

  // ── Section pages ──────────────────────────────────────────────
  let pageNum = 2
  for (const key of SECTION_ORDER) {
    const text = sections[key]
    if (!text) continue
    const label = SECTION_LABELS[key] ?? key

    // Split text into lines that fit the content width
    const lines = wrapText(text, fontRegular, 10, CONTENT_W)

    // May need multiple pages for long sections
    let lineIdx = 0
    let isFirstPageOfSection = true

    while (lineIdx < lines.length) {
      const page = doc.addPage([PAGE_W, PAGE_H])
      let y = PAGE_H - MARGIN

      // Section header (first page of each section only)
      if (isFirstPageOfSection) {
        // Amber accent bar
        page.drawRectangle({ x: MARGIN, y: y - 4, width: 32, height: 3, color: COLORS.amber })
        y -= 18

        // Section title
        page.drawText(label.toUpperCase(), {
          x: MARGIN,
          y,
          size: 8,
          font: fontBold,
          color: COLORS.amber,
          characterSpacing: 1.5,
        })
        y -= 20

        // Section headline (larger)
        page.drawText(label, {
          x: MARGIN,
          y,
          size: 18,
          font: fontBold,
          color: COLORS.ink,
        })
        y -= 10

        // Rule
        page.drawLine({
          start: { x: MARGIN, y: y - 4 },
          end: { x: PAGE_W - MARGIN, y: y - 4 },
          thickness: 0.5,
          color: COLORS.rule,
        })
        y -= 24
        isFirstPageOfSection = false
      }

      // Body text
      const bottomMargin = MARGIN + 32 // leave room for footer
      while (lineIdx < lines.length && y > bottomMargin) {
        const line = lines[lineIdx]

        // Blank line = paragraph gap
        if (line === '') {
          y -= 8
          lineIdx++
          continue
        }

        page.drawText(line, {
          x: MARGIN,
          y,
          size: 10,
          font: fontRegular,
          color: COLORS.slate600,
          lineHeight: 16,
        })
        y -= 16
        lineIdx++
      }

      // Footer
      drawFooter(page, { fontRegular, pageNum })
      pageNum++
    }
  }

  // ── Disclaimer page ────────────────────────────────────────────
  const disclaimer = doc.addPage([PAGE_W, PAGE_H])
  drawDisclaimer(disclaimer, { fontRegular, fontBold, pageNum })

  return doc.save()
}

// ── Cover page renderer ──────────────────────────────────────────

function drawCover(page: PDFPage, opts: {
  fontRegular: PDFFont
  fontBold: PDFFont
  propertyType?: string
  askingPrice?: string
  capRate?: string
}) {
  const { fontRegular, fontBold, propertyType, askingPrice, capRate } = opts

  // Full-bleed dark header band
  page.drawRectangle({
    x: 0, y: PAGE_H - 280,
    width: PAGE_W, height: 280,
    color: COLORS.ink,
  })

  // Amber accent stripe
  page.drawRectangle({
    x: 0, y: PAGE_H - 284,
    width: PAGE_W, height: 4,
    color: COLORS.amber,
  })

  // "CONFIDENTIAL OFFERING MEMORANDUM"
  page.drawText('CONFIDENTIAL', {
    x: MARGIN, y: PAGE_H - 72,
    size: 9, font: fontBold,
    color: COLORS.amber,
    characterSpacing: 3,
  })

  page.drawText('OFFERING MEMORANDUM', {
    x: MARGIN, y: PAGE_H - 110,
    size: 28, font: fontBold,
    color: COLORS.white,
  })

  // Property type
  if (propertyType) {
    page.drawText(propertyType.toUpperCase(), {
      x: MARGIN, y: PAGE_H - 148,
      size: 11, font: fontRegular,
      color: rgb(0.71, 0.769, 0.859), // slate-400
      characterSpacing: 1,
    })
  }

  // Key metrics row
  let metricX = MARGIN
  const metricY = PAGE_H - 230

  if (askingPrice) {
    page.drawText('ASKING PRICE', { x: metricX, y: metricY + 18, size: 7, font: fontBold, color: COLORS.slate400, characterSpacing: 1 })
    page.drawText(askingPrice, { x: metricX, y: metricY, size: 14, font: fontBold, color: COLORS.white })
    metricX += 160
  }

  if (capRate) {
    page.drawText('CAP RATE', { x: metricX, y: metricY + 18, size: 7, font: fontBold, color: COLORS.slate400, characterSpacing: 1 })
    page.drawText(capRate, { x: metricX, y: metricY, size: 14, font: fontBold, color: COLORS.white })
  }

  // "Prepared by ListOps Commercial" footer block
  page.drawRectangle({
    x: 0, y: 0,
    width: PAGE_W, height: 72,
    color: COLORS.cream,
  })

  page.drawText('Prepared by ListOps Commercial', {
    x: MARGIN, y: 46,
    size: 9, font: fontBold,
    color: COLORS.ink,
  })

  page.drawText('AI-powered commercial real estate analysis · listops.io', {
    x: MARGIN, y: 28,
    size: 8, font: fontRegular,
    color: COLORS.slate400,
  })

  // Confidentiality notice in body
  const notice = 'This Offering Memorandum has been prepared by ListOps Commercial for use by a limited number of parties. The information contained herein has been obtained from sources believed reliable. This document is intended solely for the use of the party to whom it is addressed and is not to be reproduced or distributed without the prior written consent of the issuing party.'
  const noticeLines = wrapText(notice, page.doc?.embedFont ? fontRegular : fontRegular, 9, CONTENT_W)

  let y = PAGE_H - 330
  page.drawText('Confidentiality Notice', {
    x: MARGIN, y,
    size: 10, font: fontBold,
    color: COLORS.ink,
  })
  y -= 18

  for (const line of noticeLines.slice(0, 6)) {
    if (!line) { y -= 6; continue }
    page.drawText(line, { x: MARGIN, y, size: 9, font: fontRegular, color: COLORS.slate600 })
    y -= 14
  }
}

// ── Footer renderer ──────────────────────────────────────────────

function drawFooter(page: PDFPage, opts: { fontRegular: PDFFont; pageNum: number }) {
  const { fontRegular, pageNum } = opts

  page.drawLine({
    start: { x: MARGIN, y: MARGIN + 20 },
    end: { x: PAGE_W - MARGIN, y: MARGIN + 20 },
    thickness: 0.5,
    color: COLORS.rule,
  })

  page.drawText('ListOps Commercial · Confidential Offering Memorandum', {
    x: MARGIN, y: MARGIN + 6,
    size: 7, font: fontRegular,
    color: COLORS.slate400,
  })

  page.drawText(`${pageNum}`, {
    x: PAGE_W - MARGIN - 10,
    y: MARGIN + 6,
    size: 7, font: fontRegular,
    color: COLORS.slate400,
  })
}

// ── Disclaimer page ──────────────────────────────────────────────

function drawDisclaimer(page: PDFPage, opts: { fontRegular: PDFFont; fontBold: PDFFont; pageNum: number }) {
  const { fontRegular, fontBold, pageNum } = opts

  page.drawRectangle({ x: 0, y: PAGE_H - 80, width: PAGE_W, height: 80, color: COLORS.ink })
  page.drawRectangle({ x: 0, y: PAGE_H - 84, width: PAGE_W, height: 4, color: COLORS.amber })

  page.drawText('DISCLAIMER', {
    x: MARGIN, y: PAGE_H - 52,
    size: 18, font: fontBold,
    color: COLORS.white,
  })

  const body = `The information in this Offering Memorandum has been obtained from sources believed reliable, however ListOps Commercial makes no guarantees, warranties, or representations as to the completeness or accuracy thereof. The presentation of this property is submitted subject to errors, omissions, change of price, rental or other conditions, withdrawal without notice, and to any special listing conditions imposed by the property owner.

AI-Generated Content Notice: Portions of this document were generated using artificial intelligence tools (ListOps Commercial powered by Anthropic Claude). All financial projections, market analyses, demographic data interpretations, and investment highlights should be independently verified by qualified professionals before making investment decisions.

Prospective purchasers are to rely upon their own investigation, evaluation, and judgment as to the advisability of purchasing the property described herein. ListOps Commercial expressly reserves the right, at its sole discretion, to reject any or all expressions of interest or offers to purchase the property and/or to terminate discussions with any entity at any time with or without notice.

This Offering Memorandum is a solicitation of interest only and is not an offer to sell the property. The owner expressly reserves the right to negotiate with one or more prospective purchasers at any time and to accept an offer to purchase the property at any time.`

  const lines = wrapText(body, fontRegular, 9, CONTENT_W)
  let y = PAGE_H - 110

  for (const line of lines) {
    if (y < MARGIN + 40) break
    if (!line) { y -= 8; continue }
    page.drawText(line, { x: MARGIN, y, size: 9, font: fontRegular, color: COLORS.slate600 })
    y -= 13
  }

  drawFooter(page, { fontRegular, pageNum })
}

// ── Text wrapping utility ────────────────────────────────────────

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.split('\n')
  const result: string[] = []

  for (const para of paragraphs) {
    if (!para.trim()) {
      result.push('')
      continue
    }

    const words = para.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = font.widthOfTextAtSize(testLine, fontSize)

      if (testWidth > maxWidth && currentLine) {
        result.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) result.push(currentLine)
    result.push('') // paragraph gap
  }

  return result
}
