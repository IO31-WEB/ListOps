/**
 * GET/POST/DELETE /api/campaigns/[id]/approval — manage the seller approval link (Pro+).
 * POST snapshots the chosen content and creates a fresh link (any previous active link is revoked). DELETE revokes.
 */
import { isCommercialLocked } from '@/lib/plan-resolve'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { rateLimitCompliance, rateLimitHeaders } from '@/lib/ratelimit'
import { checkCampaignQuota, getCampaign } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { db } from '@/lib/db'
import { approvalRequests, approvalResponses } from '@/lib/db/schema'
import { GROUPS, buildApprovalItems, summarize } from '@/lib/approval/items'

const Id = z.string().uuid()
const oneLine = (max: number) => z.string().transform(s => s.replace(/\s+/g, ' ').trim().slice(0, max))
const Body = z.object({
  sellerName: oneLine(80).optional(),
  note: oneLine(500).optional(),
  groups: z.array(z.enum(GROUPS)).min(1).max(GROUPS.length).optional(),
})
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/+$/, '')

async function ctx(rawId: string) {
  const clerkId = await requireUserId()
  const id = Id.parse(rawId)
  const rl = await rateLimitCompliance(clerkId)
  if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))
  const [campaign, quota] = await Promise.all([getCampaign(id, clerkId), checkCampaignQuota(clerkId)])
  if (!campaign) throw new ApiError(404, 'Campaign not found')
  if (isCommercialLocked((campaign as any).campaignType, quota.planTier)) throw new ApiError(403, 'Commercial campaigns are part of the Commercial plan.')
  if (!canAccess(quota.planTier, 'seller_approval')) throw new ApiError(403, 'Seller approvals are available on the Pro plan and above.')
  return { campaign }
}

async function describe(campaignId: string) {
  const r = await db.query.approvalRequests.findFirst({
    where: and(eq(approvalRequests.campaignId, campaignId), isNull(approvalRequests.revokedAt)), orderBy: [desc(approvalRequests.createdAt)],
  })
  if (!r) return null
  const rows = await db.select().from(approvalResponses).where(eq(approvalResponses.requestId, r.id))
  return {
    url: `${appUrl()}/a/${r.token}`, sellerName: r.sellerName ?? '', note: r.note ?? '', views: r.views, lastViewedAt: r.lastViewedAt, submittedAt: r.submittedAt, createdAt: r.createdAt,
    summary: summarize(r.items, rows),
    items: r.items.map(i => { const x = rows.find(y => y.itemKey === i.key); return { key: i.key, label: i.label, group: i.group, text: i.text, decision: x?.decision ?? null, comment: x?.comment ?? '', signedName: x?.signedName ?? null, decidedAt: x?.decidedAt ?? null } }),
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { campaign } = await ctx((await params).id)
    return NextResponse.json({ approval: await describe(campaign.id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleApiError(err, { route: 'approval.get' })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { campaign } = await ctx((await params).id)
    const b = Body.parse(await readJson(request, 2 * 1024))
    const items = buildApprovalItems(campaign as any, b.groups ?? GROUPS)
    if (items.length === 0) throw new ApiError(400, 'There is nothing to approve in the selected sections yet.')
    await db.update(approvalRequests).set({ revokedAt: new Date() }).where(and(eq(approvalRequests.campaignId, campaign.id), isNull(approvalRequests.revokedAt)))
    await db.insert(approvalRequests).values({
      campaignId: campaign.id, agentId: campaign.agentId, token: randomBytes(24).toString('base64url'),
      sellerName: b.sellerName || null, note: b.note || null, items,
    })
    return NextResponse.json({ approval: await describe(campaign.id) }, { status: 201 })
  } catch (err) {
    return handleApiError(err, { route: 'approval.post' })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { campaign } = await ctx((await params).id)
    await db.update(approvalRequests).set({ revokedAt: new Date() }).where(and(eq(approvalRequests.campaignId, campaign.id), isNull(approvalRequests.revokedAt)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'approval.delete' })
  }
}
