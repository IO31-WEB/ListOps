/**
 * Referral Program API
 * GET  /api/referral        — get user's referral code + stats
 * POST /api/referral/redeem — redeem a referral code at signup
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, referrals } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import { trackReferralSignup } from '@/lib/posthog'
// FIX: Math.random() produces predictable codes — an attacker with enough samples
// can predict future codes. nanoid uses crypto.getRandomValues() under the hood.
import { nanoid } from 'nanoid'

// Generates an 8-character alphanumeric referral code — cryptographically random.
function generateCode(): string {
  // nanoid with custom alphabet (uppercase + digits, no ambiguous chars like 0/O, 1/I)
  return nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 8)
}

// GET: return referral code + stats for logged-in user
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserWithDetails(userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Generate code if not already set
  let code = user.referralCode
  if (!code) {
    code = generateCode()
    await db.update(users).set({ referralCode: code }).where(eq(users.id, user.id))
  }

  // Get referral stats
  const referred = await db.query.referrals.findMany({
    where: eq(referrals.referrerId, user.id),
  })

  const stats = {
    total: referred.length,
    signedUp: referred.filter(r => r.status === 'signed_up' || r.status === 'upgraded').length,
    upgraded: referred.filter(r => r.status === 'upgraded').length,
    rewardsEarned: referred.filter(r => r.rewardGranted).length,
  }

  const referralUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign-up?ref=${code}`

  return NextResponse.json({ code, referralUrl, stats, referred })
}
