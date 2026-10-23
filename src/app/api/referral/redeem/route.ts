import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users, referrals } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import { trackReferralSignup } from '@/lib/posthog'
import { rateLimitReferral, rateLimitHeaders } from '@/lib/ratelimit'
import { assertAdult } from '@/lib/age'
import { handleApiError, readJson, ApiError } from '@/lib/api-utils'

const Schema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/) })

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: stops brute-forcing referral codes.
    const rl = await rateLimitReferral(userId)
    if (!rl.success) throw new ApiError(429, 'Too many attempts. Please try again later.', rateLimitHeaders(rl))

    const parsed = Schema.safeParse(await readJson(req, 1024))
    if (!parsed.success) throw new ApiError(400, 'Please enter a valid referral code.')
    const code = parsed.data.code

    const newUser = await getUserWithDetails(userId)
    if (!newUser) throw new ApiError(404, 'User not found')
    assertAdult(newUser)
    if (newUser.referredBy) throw new ApiError(400, 'Referral code already applied')

    const referrer = await db.query.users.findFirst({ where: eq(users.referralCode, code) })
    if (!referrer) throw new ApiError(404, 'Invalid referral code')
    if (referrer.id === newUser.id) throw new ApiError(400, 'Cannot refer yourself')

    // IDEMPOTENT / race-safe: claim the "referred_by" slot atomically. If two requests race, only one gets a row back,
    // so a referral can never be recorded (and rewarded) twice.
    const claimed = await db.update(users).set({ referredBy: referrer.id })
      .where(and(eq(users.id, newUser.id), isNull(users.referredBy)))
      .returning({ id: users.id })
    if (claimed.length === 0) throw new ApiError(400, 'Referral code already applied')

    await db.insert(referrals).values({
      referrerId: referrer.id, referredUserId: newUser.id, referredEmail: newUser.email, status: 'signed_up', rewardGranted: false,
    })

    trackReferralSignup({ referrerId: referrer.clerkId, newUserId: userId, referralCode: code })
    return NextResponse.json({ success: true, message: 'Referral applied! You\'ll both get a free month when you upgrade.' })
  } catch (err) {
    return handleApiError(err, { route: 'referral/redeem' })
  }
}
