/** PUT /api/referral/payout-email — the referrer tells us where to send commission payouts (PayPal / Zelle email). */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { logAudit } from '@/lib/audit'

const Schema = z.object({ payoutEmail: z.string().trim().toLowerCase().email().max(254).or(z.literal('')) })

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { userId } = await auth()
    if (!userId) throw new ApiError(401, 'Unauthorized')
    const { payoutEmail } = Schema.parse(await readJson(request, 1024))
    const me = await db.query.users.findFirst({ where: eq(users.clerkId, userId), columns: { id: true } })
    if (!me) throw new ApiError(404, 'User not found')
    await db.update(users).set({ payoutEmail: payoutEmail || null }).where(eq(users.id, me.id))
    await logAudit({ action: 'user.payout_email_set', actorClerkId: userId, targetUserId: me.id, request, metadata: { cleared: !payoutEmail } })
    return NextResponse.json({ ok: true, payoutEmail: payoutEmail || null })
  } catch (err) {
    return handleApiError(err, { route: 'referral.payout-email' })
  }
}
