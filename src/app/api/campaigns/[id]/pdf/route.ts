/**
 * PDF Generation API
 * POST /api/campaigns/[id]/pdf
 *
 * Generates a print-ready PDF of the campaign flyer using Puppeteer
 * (via the existing /flyer/[id] route rendered to HTML, then printed).
 *
 * Falls back to returning the flyer page URL if Puppeteer isn't available.
 * Uploads to R2 and caches the URL on the campaign record.
 *
 * For production Puppeteer PDF generation, use:
 *   npm install @sparticuz/chromium puppeteer-core
 * And deploy on a platform that supports it (Vercel Pro, AWS Lambda, etc).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCampaign, checkCampaignQuota } from '@/lib/user-service'
import { uploadToR2 } from '@/lib/r2'
import { canAccessFeature } from '@/lib/stripe'
import { trackFlyerDownloaded } from '@/lib/posthog'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const [campaign, quota] = await Promise.all([
      getCampaign(id, userId),
      checkCampaignQuota(userId),
    ])

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const planTier = quota.planTier

    // All plans can download flyers — free plan gets basic template
    // Return cached URL if already generated
    if ((campaign as any).pdfUrl) {
      trackFlyerDownloaded({ userId, campaignId: id, template: 'cached', planTier })
      return NextResponse.json({ url: (campaign as any).pdfUrl, cached: true })
    }

    // ── Try Puppeteer PDF generation ──────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const flyerUrl = `${appUrl}/flyer/${id}?template=classic&print=1`

    let pdfBuffer: Buffer | null = null

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const chromium = (() => { try { return require('@sparticuz/chromium') } catch { return null } })()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const puppeteer = (() => { try { return require('puppeteer-core') } catch { return null } })()

      if (chromium && puppeteer) {
        const browser = await puppeteer.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: true,
        })

        const page = await browser.newPage()
        await page.goto(flyerUrl, { waitUntil: 'networkidle0', timeout: 30000 })
        await page.emulateMediaType('print')

        pdfBuffer = Buffer.from(await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        }))

        await browser.close()
      }
    } catch (puppeteerErr) {
      console.warn('[pdf] Puppeteer not available, returning flyer page URL:', puppeteerErr)
    }

    // ── Upload to R2 if we have a PDF ─────────────────────────
    let pdfUrl: string | null = null

    if (pdfBuffer) {
      const key = `flyers/${id}/campaign-flyer.pdf`
      pdfUrl = await uploadToR2({
        key,
        body: pdfBuffer,
        contentType: 'application/pdf',
      })
    }

    // Fall back to flyer page URL if no R2/Puppeteer
    const finalUrl = pdfUrl ?? flyerUrl

    // Cache on campaign record if we got a real PDF URL
    if (pdfUrl) {
      await db
        .update(campaigns)
        .set({ flyerUrl: pdfUrl, updatedAt: new Date() } as any)
        .where(eq(campaigns.id, id))
    }

    trackFlyerDownloaded({
      userId,
      campaignId: id,
      template: 'classic',
      planTier,
    })

    return NextResponse.json({
      url: finalUrl,
      isPdf: !!pdfBuffer,
      cached: false,
    })
  } catch (err) {
    console.error('[pdf] Generation error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
