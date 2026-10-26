/**
 * POST /api/campaigns/[id]/social/schedule — put a campaign's generated Facebook / Instagram / LinkedIn posts on the calendar.
 * Body: { startDate: 'YYYY-MM-DD' (agent's local date), channels?: [...] }. Idempotent: posts already queued are skipped.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { getCampaign } from '@/lib/user-service'
import { db } from '@/lib/db'
import { socialPosts } from '@/lib/db/schema'
import { loadSocialContext } from '@/lib/social/context'
import { CHANNELS, extractPosts, planSchedule } from '@/lib/social/plan'
import { isIsoDate, localParts } from '@/lib/social/time'

const Body = z.object({
  startDate: z.string().refine(isIsoDate, 'Invalid date'),
  channels: z.array(z.enum(CHANNELS)).min(1).max(CHANNELS.length).optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const id = z.string().uuid().parse((await params).id)
    const { user, tz } = await loadSocialContext(clerkId)
    const body = Body.parse(await readJson(request, 2 * 1024))
    if (body.startDate < localParts(new Date(), tz).date) throw new ApiError(400, 'Pick a start date that is today or later.')

    const campaign = await getCampaign(id, clerkId)
    if (!campaign) throw new ApiError(404, 'Campaign not found')
    const sources = extractPosts(campaign as any, body.channels ?? CHANNELS)
    if (sources.length === 0) throw new ApiError(400, 'This campaign has no social posts to schedule.')

    const planned = planSchedule(body.startDate, tz, sources)
    const inserted = await db.insert(socialPosts).values(planned.map(p => ({
      agentId: user.id, campaignId: campaign.id, channel: p.channel, sourceKey: p.sourceKey, week: p.week, body: p.body, scheduledFor: p.scheduledFor,
    }))).onConflictDoNothing().returning({ id: socialPosts.id })
    return NextResponse.json({ created: inserted.length, alreadyQueued: planned.length - inserted.length }, { status: 201 })
  } catch (err) {
    return handleApiError(err, { route: 'social/schedule' })
  }
}
