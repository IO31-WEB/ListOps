/**
 * POST /api/admin/referrals/pay — admin marks a referrer's PAYABLE commissions as paid (the money moves outside the app).
 * Atomic (one UPDATE … WHERE status='pending' AND eligible_at <= now), so a double click or retry cannot pay twice.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { assertSameOrigin, requireAdminApi } from '@/lib/admin'
import { logAudit } from '@/lib/audit'
import { rateLimitAdmin, rateLimitHeaders } from '@/lib/ratelimit'
import { markCommissionsPaid } from '@/lib/referral-commissions'

const Schema = z.object({
  referrerId: z.string().uuid(),
  method: z.enum(['paypal', 'zelle', 'venmo', 'ach', 'check', 'other']),
  reference: z.string().trim().min(3, 'Add the transaction id / note so the payout can be traced').max(200),
})

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const admin = await requireAdminApi()
    const rl = await rateLimitAdmin(admin.clerkId)
    if (!rl.success) throw new ApiError(429, 'Too many admin actions. Slow down.', rateLimitHeaders(rl))
    const body = Schema.parse(await readJson(request, 2 * 1024))

    const target = await db.query.users.findFirst({ where: eq(users.id, body.referrerId), columns: { id: true, email: true, payoutEmail: true } })
    if (!target) throw new ApiError(404, 'Referrer not found')
    const adminRow = await db.query.users.findFirst({ where: eq(users.clerkId, admin.clerkId), columns: { id: true } })

    const res = await markCommissionsPaid({ referrerId: target.id, method: body.method, reference: body.reference, paidBy: adminRow?.id ?? target.id })
    if (res.count === 0) throw new ApiError(409, 'Nothing is payable for this referrer right now (already paid, or still inside the hold period).')

    await logAudit({
      action: 'admin.referral_payout', actorClerkId: admin.clerkId, actorEmail: admin.email, targetUserId: target.id, request,
      metadata: { method: body.method, reference: body.reference, commissions: res.count, totalCents: res.totalCents, payoutEmail: target.payoutEmail, referrerEmail: target.email },
    })
    return NextResponse.json({ ok: true, count: res.count, totalCents: res.totalCents })
  } catch (err) {
    return handleApiError(err, { route: 'admin/referrals.pay' })
  }
}
