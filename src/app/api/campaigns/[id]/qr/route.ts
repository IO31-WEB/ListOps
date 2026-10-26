/** POST /api/campaigns/[id]/qr {placement} — create (or fetch) this campaign's trackable QR code for a placement. Starter+. */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { checkCampaignQuota, getCampaign } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { rateLimitHeaders, rateLimitQrManage } from '@/lib/ratelimit'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { QR_PLACEMENTS, qrTargetUrl } from '@/lib/qr/codes'
import { getOrCreateQr } from '@/lib/qr/service'

const Body = z.object({ placement: z.enum(QR_PLACEMENTS) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const id = z.string().uuid().parse((await params).id)
    const rl = await rateLimitQrManage(clerkId)
    if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))
    const { placement } = Body.parse(await readJson(request, 512))
    const [campaign, quota, user] = await Promise.all([getCampaign(id, clerkId), checkCampaignQuota(clerkId), db.query.users.findFirst({ where: eq(users.clerkId, clerkId), columns: { id: true } })])
    if (!campaign || !user) throw new ApiError(404, 'Campaign not found')
    if (!canAccess(quota.planTier, 'qr_codes')) throw new ApiError(403, 'QR codes are available on the Starter plan and above.')
    if (!campaign.micrositeSlug) throw new ApiError(400, 'Publish this listing\'s microsite first — the QR code opens it.')
    const qr = await getOrCreateQr(campaign.id, user.id, placement)
    return NextResponse.json({ code: qr.code, placement: qr.placement, url: qrTargetUrl(qr.code) }, { status: 201 })
  } catch (err) {
    return handleApiError(err, { route: 'campaigns/qr' })
  }
}
