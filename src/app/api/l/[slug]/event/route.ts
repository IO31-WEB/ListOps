/**
 * POST /api/l/[slug]/event — PUBLIC. The microsite reports a click on the agent's phone / email button.
 * Only two event kinds are accepted; per-IP and per-listing rate limits keep the counters from being inflated cheaply.
 * Stores a counter only — no IP, no user agent, no personal data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { rateLimitHeaders, rateLimitLeadIp, rateLimitLeadSlug } from '@/lib/ratelimit'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { recordEvent } from '@/lib/performance/record'
import { PUBLIC_EVENT_KINDS, isBotUserAgent } from '@/lib/performance/stats'

const Body = z.object({ kind: z.enum(PUBLIC_EVENT_KINDS) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const rl = await rateLimitLeadIp(`ev:${ip}`)
    if (!rl.success) throw new ApiError(429, 'Too many requests.', rateLimitHeaders(rl))
    const rs = await rateLimitLeadSlug(`ev:${slug.slice(0, 200)}`)
    if (!rs.success) throw new ApiError(429, 'Too many requests.', rateLimitHeaders(rs))

    const { kind } = Body.parse(await readJson(request, 512))
    if (isBotUserAgent(request.headers.get('user-agent'))) return NextResponse.json({ ok: true })

    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.micrositeSlug, slug), columns: { id: true, micrositePublished: true } })
    if (!c || !c.micrositePublished) throw new ApiError(404, 'Not found')
    await recordEvent(c.id, kind)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'l/event' })
  }
}
