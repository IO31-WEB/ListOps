/**
 * POST /api/admin/users/:id/quota — admin-only quota adjustments. Every call is audit-logged with a REQUIRED reason.
 *
 *   { mode: 'refund', campaignId?, reason }   give back 1 generation (marks the campaign refunded so it can't be refunded twice)
 *   { mode: 'set_used', value, reason }       set "campaigns used this month" to an exact number
 *   { mode: 'grant', amount, reason }         give N extra generations (lowers "used" by N, floor 0)
 *
 * "Refund" means returning the generation to the user's quota — it does not touch Stripe money.
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { campaigns, users } from '@/lib/db/schema'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { assertSameOrigin, requireAdminApi } from '@/lib/admin'
import { logAudit } from '@/lib/audit'
import { rateLimitAdmin, rateLimitHeaders } from '@/lib/ratelimit'

const reason = z.string().trim().min(5, 'A reason is required').max(300)
const Schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('refund'), campaignId: z.string().uuid().optional(), reason }),
  z.object({ mode: z.literal('set_used'), value: z.number().int().min(0).max(100_000), reason }),
  z.object({ mode: z.literal('grant'), amount: z.number().int().min(1).max(1000), reason }),
])

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const admin = await requireAdminApi()
    const rl = await rateLimitAdmin(admin.clerkId)
    if (!rl.success) throw new ApiError(429, 'Too many admin actions. Slow down.', rateLimitHeaders(rl))

    const { id } = await ctx.params
    const body = Schema.parse(await readJson(request, 4 * 1024))

    const target = await db.query.users.findFirst({
      where: eq(users.id, z.string().uuid().parse(id)),
      columns: { id: true, email: true, campaignsUsedThisMonth: true, campaignsUsedTotal: true },
    })
    if (!target) throw new ApiError(404, 'User not found')
    const before = target.campaignsUsedThisMonth

    let refundedCampaign: string | undefined
    if (body.mode === 'refund') {
      if (body.campaignId) {
        // Atomic: only succeeds if this campaign belongs to the user AND hasn't been refunded yet.
        const claimed = await db
          .update(campaigns)
          .set({ refundedAt: new Date() })
          .where(and(eq(campaigns.id, body.campaignId), eq(campaigns.agentId, target.id), isNull(campaigns.refundedAt)))
          .returning({ id: campaigns.id })
        if (!claimed.length) throw new ApiError(409, 'That generation was already refunded (or does not belong to this user).')
        refundedCampaign = claimed[0].id
      }
      await db.update(users).set({
        campaignsUsedThisMonth: sql`GREATEST(${users.campaignsUsedThisMonth} - 1, 0)`,
        campaignsUsedTotal: sql`GREATEST(${users.campaignsUsedTotal} - 1, 0)`,
      }).where(eq(users.id, target.id))
    } else if (body.mode === 'grant') {
      await db.update(users).set({
        campaignsUsedThisMonth: sql`GREATEST(${users.campaignsUsedThisMonth} - ${body.amount}, 0)`,
      }).where(eq(users.id, target.id))
    } else {
      await db.update(users).set({ campaignsUsedThisMonth: body.value }).where(eq(users.id, target.id))
    }

    const after = await db.query.users.findFirst({ where: eq(users.id, target.id), columns: { campaignsUsedThisMonth: true } })

    await logAudit({
      action: 'admin.quota_adjust',
      actorClerkId: admin.clerkId, actorEmail: admin.email, targetUserId: target.id, request,
      metadata: {
        mode: body.mode, reason: body.reason, targetEmail: target.email,
        usedBefore: before, usedAfter: after?.campaignsUsedThisMonth,
        ...(refundedCampaign ? { campaignId: refundedCampaign } : {}),
        ...(body.mode === 'grant' ? { amount: body.amount } : {}),
        ...(body.mode === 'set_used' ? { value: body.value } : {}),
      },
    })
    return NextResponse.json({ ok: true, usedBefore: before, usedAfter: after?.campaignsUsedThisMonth ?? null })
  } catch (err) {
    return handleApiError(err, { route: 'admin/quota' })
  }
}
