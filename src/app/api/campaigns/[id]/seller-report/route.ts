/**
 * GET/POST/DELETE /api/campaigns/[id]/seller-report — manage the shareable seller report link (Pro+).
 * POST creates a fresh link (any previous active link is revoked, so old copies stop working). DELETE revokes.
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
import { sellerReports } from '@/lib/db/schema'

const Id = z.string().uuid()
const Body = z.object({ note: z.string().transform(s => s.replace(/\s+/g, ' ').trim().slice(0, 500)).optional() })
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/+$/, '')

async function ctx(rawId: string) {
  const clerkId = await requireUserId()
  const id = Id.parse(rawId)
  const rl = await rateLimitCompliance(clerkId)
  if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))
  const [campaign, quota] = await Promise.all([getCampaign(id, clerkId), checkCampaignQuota(clerkId)])
  if (!campaign) throw new ApiError(404, 'Campaign not found')
  if (isCommercialLocked((campaign as any).campaignType, quota.planTier)) throw new ApiError(403, 'Commercial campaigns are part of the Commercial plan.')
  if (!canAccess(quota.planTier, 'seller_report')) throw new ApiError(403, 'Seller reports are available on the Pro plan and above.')
  return { campaign }
}

const view = (r: typeof sellerReports.$inferSelect) => ({
  url: `${appUrl()}/r/${r.token}`, note: r.note ?? '', views: r.views, lastViewedAt: r.lastViewedAt, createdAt: r.createdAt,
})

async function active(campaignId: string) {
  return db.query.sellerReports.findFirst({
    where: and(eq(sellerReports.campaignId, campaignId), isNull(sellerReports.revokedAt)), orderBy: [desc(sellerReports.createdAt)],
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { campaign } = await ctx((await params).id)
    const r = await active(campaign.id)
    return NextResponse.json({ report: r ? view(r) : null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleApiError(err, { route: 'seller-report.get' })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { campaign } = await ctx((await params).id)
    const { note } = Body.parse(await readJson(request, 2 * 1024))
    await db.update(sellerReports).set({ revokedAt: new Date() }).where(and(eq(sellerReports.campaignId, campaign.id), isNull(sellerReports.revokedAt)))
    const [r] = await db.insert(sellerReports).values({
      campaignId: campaign.id, agentId: campaign.agentId, token: randomBytes(24).toString('base64url'), note: note || null,
    }).returning()
    return NextResponse.json({ report: view(r) }, { status: 201 })
  } catch (err) {
    return handleApiError(err, { route: 'seller-report.post' })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { campaign } = await ctx((await params).id)
    await db.update(sellerReports).set({ revokedAt: new Date() }).where(and(eq(sellerReports.campaignId, campaign.id), isNull(sellerReports.revokedAt)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'seller-report.delete' })
  }
}
