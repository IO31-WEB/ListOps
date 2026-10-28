import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { claimReferral } from '@/lib/referrals'
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

    const res = await claimReferral(newUser, code)
    if (!res.ok) throw new ApiError(res.status, res.error)

    trackReferralSignup({ referrerId: res.referrerClerkId, newUserId: userId, referralCode: code })
    return NextResponse.json({ success: true, message: 'Referral applied! It's counted as upgraded once you subscribe to a paid plan.' })
  } catch (err) {
    return handleApiError(err, { route: 'referral/redeem' })
  }
}
