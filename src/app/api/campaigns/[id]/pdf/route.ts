/**
 * PDF Generation API
 * POST /api/campaigns/[id]/pdf
 *
 * FIX: Removed `as any` type cast that was hiding a Drizzle schema/DB mismatch.
 * pdfUrl is now properly typed in the schema update call.
 *
 * Strategy:
 * 1. Return cached R2 URL if already generated
 * 2. Try Puppeteer (if @sparticuz/chromium + puppeteer-core installed) → upload to R2
 * 3. Fall back to flyer page URL (browser print)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { readJson } from '@/lib/api-utils'
import { signPrintToken } from '@/lib/print-token'
import { SCHEME_IDS } from '@/lib/color-schemes'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCampaign, checkCampaignQuota } from '@/lib/user-service'
import { rateLimitPdf, rateLimitHeaders } from '@/lib/ratelimit'
import { uploadToR2 } from '@/lib/r2'
import { trackFlyerDownloaded } from '@/lib/posthog'

// Flyer options chosen in the flyer toolbar. Plan limits are enforced by the flyer page itself.
const FlyerOptions = z.object({
  template: z.enum(['classic', 'luxury', 'modern']).default('classic'),
  scheme: z.enum(SCHEME_IDS).default('brand'),
  badge: z.enum(['justListed', 'openHouse', 'priceReduced']).default('justListed'),
  date: z.string().max(40).optional(),
  time: z.string().max(40).optional(),
  was: z.string().regex(/^\d{1,9}$/).optional(),
}).default({ template: 'classic', scheme: 'brand', badge: 'justListed' })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const pdfRl = await rateLimitPdf(userId)
  if (!pdfRl.success) return NextResponse.json({ error: 'Too many PDF requests. Please wait a few minutes.' }, { status: 429, headers: rateLimitHeaders(pdfRl) })

  const { id } = await params

  try {
    let opts: z.infer<typeof FlyerOptions>
    try {
      const raw = req.headers.get('content-length') === '0' ? undefined : await readJson(req, 4 * 1024).catch(() => undefined)
      opts = FlyerOptions.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid flyer options' }, { status: 400 })
    }
    const isDefault = opts.template === 'classic' && opts.scheme === 'brand' && opts.badge === 'justListed'
    const optKey = createHash('sha1').update(JSON.stringify(opts)).digest('hex').slice(0, 12)

    const [campaign, quota] = await Promise.all([
      getCampaign(id, userId),
      checkCampaignQuota(userId),
    ])

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const planTier = quota.planTier
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listops.io'
    const query = new URLSearchParams({ template: opts.template, scheme: opts.scheme, badge: opts.badge })
    if (opts.date) query.set('date', opts.date)
    if (opts.time) query.set('time', opts.time)
    if (opts.was) query.set('was', opts.was)
    const flyerUrl = `${appUrl}/flyer/${id}?${query.toString()}`

    // Return the cached PDF only for the default flyer (custom options render fresh).
    const cachedUrl = campaign.pdfUrl ?? campaign.flyerUrl
    if (isDefault && cachedUrl?.startsWith('http') && cachedUrl?.includes('r2')) {
      trackFlyerDownloaded({ userId, campaignId: id, template: 'cached', planTier })
      return NextResponse.json({ url: cachedUrl, cached: true, isPdf: true })
    }

    // ── Attempt Puppeteer PDF generation ──────────────────────
    let pdfBuffer: Buffer | null = null

    try {
      const chromium = (() => { try { return eval("require")('@sparticuz/chromium') } catch { return null } })()
      const puppeteer = (() => { try { return eval("require")('puppeteer-core') } catch { return null } })()

      if (chromium && puppeteer) {
        console.log('[pdf] Puppeteer available — generating PDF')

        const executablePath = await chromium.executablePath()
        const browser = await puppeteer.launch({
          args: [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
          defaultViewport: { width: 1200, height: 900 },
          executablePath,
          headless: true,
        })

        try {
          const page = await browser.newPage()
          // The renderer has no Clerk session: a 3-minute signed token authorizes this ONE campaign's flyer page.
          query.set('pt', signPrintToken(id))
          await page.goto(`${appUrl}/flyer/${id}?${query.toString()}`, {
            waitUntil: 'networkidle0',
            timeout: 30000,
          })

          await page.evaluate(() =>
            Promise.all(
              Array.from(document.images)
                .filter(img => !img.complete)
                .map(img => new Promise(resolve => { img.onload = img.onerror = resolve }))
            )
          )

          await page.emulateMediaType('print')

          const pdfBytes = await page.pdf({
            format: 'Letter',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
          })

          pdfBuffer = Buffer.from(pdfBytes)
        } finally {
          await browser.close()
        }
      } else {
        console.log('[pdf] Puppeteer not installed — using flyer URL fallback')
      }
    } catch (puppeteerErr) {
      console.warn('[pdf] Puppeteer error:', puppeteerErr)
    }

    // ── Upload to R2 ───────────────────────────────────────────
    let pdfUrl: string | null = null

    if (pdfBuffer) {
      const key = isDefault ? `flyers/${id}/listing-flyer.pdf` : `flyers/${id}/listing-flyer-${optKey}.pdf`
      pdfUrl = await uploadToR2({
        key,
        body: pdfBuffer,
        contentType: 'application/pdf',
      })

      if (pdfUrl && isDefault) {
        // FIX: pdfUrl is a proper column in the schema — no `as any` cast needed
        await db
          .update(campaigns)
          .set({ pdfUrl, updatedAt: new Date() })
          .where(eq(campaigns.id, id))

        console.log(`[pdf] Uploaded to R2: ${pdfUrl}`)
      }
    }

    const finalUrl = pdfUrl ?? flyerUrl
    const isPdf = !!pdfBuffer && !!pdfUrl

    trackFlyerDownloaded({ userId, campaignId: id, template: opts.template, planTier })

    return NextResponse.json({ url: finalUrl, isPdf, cached: false })
  } catch (err) {
    console.error('[pdf] Error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
