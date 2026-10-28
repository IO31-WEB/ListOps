/**
 * POST /api/l/[slug]/lead — PUBLIC endpoint behind the microsite's "Schedule a Showing" / "Request Info" forms.
 * Protections: strict zod validation + body cap, honeypot + minimum-fill-time + link-spam checks (bots get a fake
 * success), per-IP and per-listing rate limits (fail closed), explicit consent required (text is stored with the lead),
 * 10-minute duplicate suppression, plan gate on the listing OWNER, IP stored only as a salted hash.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createHash } from 'node:crypto'
import { and, eq, gte } from 'drizzle-orm'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { rateLimitHeaders, rateLimitLeadIp, rateLimitLeadSlug } from '@/lib/ratelimit'
import { db } from '@/lib/db'
import { campaigns, leads } from '@/lib/db/schema'
import { canAccess } from '@/lib/plans'
import { getPlanTierForUserId } from '@/lib/user-service'
import { LeadInput } from '@/lib/leads/input'
import { botReason, consentText } from '@/lib/leads/sanitize'
import { deliverLead } from '@/lib/leads/service'

export const maxDuration = 30

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}
const hashIp = (ip: string) =>
  createHash('sha256').update(`${process.env.PRINT_TOKEN_SECRET || process.env.CLERK_SECRET_KEY || 'listops'}:${ip}`).digest('hex').slice(0, 32)

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const ip = clientIp(request)

    const rlIp = await rateLimitLeadIp(ip)
    if (!rlIp.success) throw new ApiError(429, 'Too many requests. Please try again in a few minutes.', rateLimitHeaders(rlIp))
    const rlSlug = await rateLimitLeadSlug(slug.slice(0, 200))
    if (!rlSlug.success) throw new ApiError(429, 'This listing is receiving a lot of requests. Please try again later.', rateLimitHeaders(rlSlug))

    const data = LeadInput.parse(await readJson(request, 8 * 1024))

    // Looks automated: pretend success so bots learn nothing.
    if (botReason({ website: data.website, elapsedMs: data.elapsedMs, message: data.message ?? undefined })) {
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.micrositeSlug, slug),
      with: { brandKit: true },
      columns: { id: true, agentId: true, listingId: true, brandKitId: true, micrositePublished: true },
    })
    if (!campaign || !campaign.micrositePublished) throw new ApiError(404, 'Listing not found')

    const plan = await getPlanTierForUserId(campaign.agentId)
    if (!canAccess(plan, 'lead_capture')) throw new ApiError(403, 'This listing is not accepting online requests. Please contact the agent directly.')

    // Same person re-submitting the same kind of request within 10 minutes (double-click, refresh) is one lead.
    const dup = await db.query.leads.findFirst({
      where: and(
        eq(leads.campaignId, campaign.id), eq(leads.email, data.email), eq(leads.kind, data.kind),
        gte(leads.createdAt, new Date(Date.now() - 10 * 60 * 1000)),
      ),
      columns: { id: true },
    })
    if (dup) return NextResponse.json({ ok: true }, { status: 201 })

    const [row] = await db.insert(leads).values({
      campaignId: campaign.id,
      agentId: campaign.agentId,
      listingId: campaign.listingId,
      kind: data.kind,
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
      preferredDate: data.kind === 'showing' ? data.preferredDate ?? null : null,
      preferredTime: data.kind === 'showing' ? data.preferredTime ?? null : null,
      source: data.source ?? data.referrer ?? 'direct',
      medium: data.medium,
      campaignTag: data.campaignTag,
      referrerHost: data.referrer,
      consentText: consentText(campaign.brandKit?.agentName),
      ipHash: hashIp(ip),
    }).returning({ id: leads.id })

    // Runs after the response is sent, so the visitor never waits on email/webhook latency.
    after(() => deliverLead(row.id))

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return handleApiError(err, { route: 'l/lead' })
  }
}
