/**
 * GET /api/campaigns/[id]/visual-kit?kind=ig-square&format=png|pdf&scheme=brand&date=&time=&oldPrice=&download=1
 *
 * Renders one branded graphic from the campaign's real listing data + brand kit + the agent's own photos.
 * Auth -> ownership -> rate limit -> plan gate -> render. Nothing is stored; every request renders fresh
 * (browsers may cache a preview for 60 s). No engagement numbers or claims are ever drawn.
 */
import { isCommercialLocked } from '@/lib/plan-resolve'
import { recordEvent } from '@/lib/performance/record'
import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'
import { ApiError, handleApiError, requireUserId } from '@/lib/api-utils'
import { rateLimitVisualKit, rateLimitHeaders } from '@/lib/ratelimit'
import { checkCampaignQuota, getCampaign } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { SCHEME_IDS } from '@/lib/color-schemes'
import { slugify } from '@/lib/utils'
import { KIT_CATALOG, KIT_KINDS, kindAllowed, kitPdfAllowed, kitWatermarked } from '@/lib/visual-kit/catalog'
import { loadKitData } from '@/lib/visual-kit/data'
import { renderKit } from '@/lib/visual-kit/render'

export const maxDuration = 60

const Query = z.object({
  kind: z.enum(KIT_KINDS),
  format: z.enum(['png', 'pdf']).default('png'),
  scheme: z.enum(SCHEME_IDS).default('brand'),
  date: z.string().max(40).optional(),
  time: z.string().max(40).optional(),
  oldPrice: z.coerce.number().int().min(1).max(500_000_000).optional(),
  shift: z.coerce.number().int().min(0).max(9).default(0),
  download: z.enum(['1']).optional(),
})
const IdSchema = z.string().uuid()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const rl = await rateLimitVisualKit(userId)
    if (!rl.success) throw new ApiError(429, 'Too many image requests. Please wait a few minutes.', rateLimitHeaders(rl))

    const { id: rawId } = await params
    const id = IdSchema.parse(rawId)
    const q = Query.parse(Object.fromEntries(new URL(request.url).searchParams))

    const [campaign, quota] = await Promise.all([getCampaign(id, userId), checkCampaignQuota(userId)])
    if (!campaign) throw new ApiError(404, 'Campaign not found')
    const plan = quota.planTier
    if (isCommercialLocked((campaign as any).campaignType, plan)) throw new ApiError(403, 'Commercial campaigns are part of the Commercial plan.')

    if (!kindAllowed(plan, q.kind)) throw new ApiError(403, 'This graphic is included with Starter and above. Upgrade to unlock the full visual kit.')
    if (q.format === 'pdf' && !kitPdfAllowed(plan)) throw new ApiError(403, 'PDF export is included with Pro and above.')
    // Color schemes are a Pro feature (the brand-kit colors are Starter+, free renders with defaults).
    const scheme = canAccess(plan, 'flyer_schemes') ? q.scheme : 'brand'

    const brandOk = canAccess(plan, 'brand_kit')
    const data = await loadKitData(
      campaign,
      { scheme, date: q.date, time: q.time, oldPrice: q.oldPrice, watermark: kitWatermarked(plan), shift: q.shift },
      brandOk,
      q.kind
    )

    const { width, height } = KIT_CATALOG[q.kind]
    const png = new ImageResponse(renderKit(q.kind, data), { width, height })
    const base = slugify(data.fullAddress || 'listing') || 'listing'

    if (q.download) await recordEvent(campaign.id, 'kit_download')

    if (q.format === 'png') {
      const bytes = await png.arrayBuffer()
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, max-age=60',
          ...(q.download ? { 'Content-Disposition': `attachment; filename="${base}-${q.kind}.png"` } : {}),
        },
      })
    }

    // PDF: one page, the PNG embedded at 0.75 pt/px (1080 px -> 11.25 in), so it prints sharp at that size.
    const pdf = await PDFDocument.create()
    const img = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()))
    const pw = width * 0.75, ph = height * 0.75
    pdf.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph })
    const pdfBytes = await pdf.save()
    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=60',
        'Content-Disposition': `${q.download ? 'attachment' : 'inline'}; filename="${base}-${q.kind}.pdf"`,
      },
    })
  } catch (err) {
    return handleApiError(err, { route: 'campaigns/[id]/visual-kit' })
  }
}
