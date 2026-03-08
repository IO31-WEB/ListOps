import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserWithDetails } from '@/lib/user-service'
import { PLANS } from '@/lib/stripe'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await getUserWithDetails(userId)

  return NextResponse.json({
    userId,
    dbUserExists: !!dbUser,
    orgExists: !!dbUser?.organization,
    orgPlan: dbUser?.organization?.plan ?? null,
    stripeCustomerId: dbUser?.organization?.stripeCustomerId ?? null,
    plans: PLANS.filter(p => p.id !== 'free').map(p => ({
      id: p.id,
      monthlyPriceId: p.monthlyPriceId || 'MISSING',
      yearlyPriceId: p.yearlyPriceId || 'MISSING',
    })),
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
    stripeKeySet: !!process.env.STRIPE_SECRET_KEY,
  })
}
