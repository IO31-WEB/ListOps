import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, referrals } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import { trackReferralSignup } from '@/lib/posthog'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Referral code required' }, { status: 400 })

  const newUser = await getUserWithDetails(userId)
  if (!newUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Already used a referral code
  if (newUser.referredBy) {
    return NextResponse.json({ error: 'Referral code already applied' }, { status: 400 })
  }

  // Find referrer
  const referrer = await db.query.users.findFirst({
    where: eq(users.referralCode, code.toUpperCase()),
  })

  if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
  if (referrer.id === newUser.id) return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })

  // Record referral
  await db.insert(referrals).values({
    referrerId: referrer.id,
    referredUserId: newUser.id,
    referredEmail: newUser.email,
    status: 'signed_up',
    rewardGranted: false,
  })

  // Mark new user as referred
  await db.update(users)
    .set({ referredBy: referrer.id })
    .where(eq(users.id, newUser.id))

  trackReferralSignup({
    referrerId: referrer.clerkId,
    newUserId: userId,
    referralCode: code,
  })

  return NextResponse.json({ success: true, message: 'Referral applied! You\'ll both get a free month when you upgrade.' })
}
