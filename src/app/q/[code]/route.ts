/**
 * GET /q/[code] — PUBLIC. The URL printed in a QR code. Counts the scan, then 302s to the listing microsite.
 * Not counted: crawlers / link-preview bots, the signed-in owner (testing their own sign), and over-limit traffic.
 * Stores a daily counter only — no IP, device or personal data. Unknown / unpublished codes go to the home page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns, users } from '@/lib/db/schema'
import { CODE_RE, micrositeLanding } from '@/lib/qr/codes'
import { recordScan } from '@/lib/qr/service'
import { isBotUserAgent } from '@/lib/performance/stats'
import { rateLimitQr } from '@/lib/ratelimit'

const go = (request: NextRequest, path: string) => {
  const res = NextResponse.redirect(new URL(path, request.nextUrl.origin), 302)
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('Referrer-Policy', 'no-referrer')
  return res
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = (await params).code.toLowerCase()
    if (!CODE_RE.test(code)) return go(request, '/')
    const qr = await db.query.qrCodes.findFirst({ where: (t, { eq: e }) => e(t.code, code) })
    if (!qr) return go(request, '/')
    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, qr.campaignId), columns: { micrositeSlug: true, micrositePublished: true } })
    if (!c?.micrositeSlug || !c.micrositePublished) return go(request, '/')

    let count = !isBotUserAgent(request.headers.get('user-agent'))
    if (count) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
      if (!(await rateLimitQr(ip)).success) count = false
    }
    if (count) {
      try {
        const { userId } = await auth()
        if (userId) {
          const owner = await db.query.users.findFirst({ where: eq(users.id, qr.agentId), columns: { clerkId: true } })
          if (owner?.clerkId === userId) count = false
        }
      } catch { /* no session context: treat as anonymous */ }
    }
    if (count) await recordScan(qr.id)
    return go(request, micrositeLanding(c.micrositeSlug, qr.placement))
  } catch (err) {
    console.error('[qr] redirect failed', err)
    return go(request, '/')
  }
}
