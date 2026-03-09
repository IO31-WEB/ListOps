/**
 * Debug Route
 *
 * FIX: Previously exposed Stripe price IDs, customer IDs, and infrastructure
 * details to ANY authenticated user. That's an information disclosure vulnerability.
 *
 * Now: Hard-blocked in production. Only accessible in development.
 * Sensitive fields (stripeCustomerId, price IDs) removed from response.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserWithDetails } from '@/lib/user-service'

export async function GET() {
  // FIX: Hard gate — returns 404 in production, not 401, to avoid confirming route existence
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await getUserWithDetails(userId)

  // FIX: No price IDs, no Stripe customer IDs, no infrastructure details
  return NextResponse.json({
    userId,
    dbUserExists: !!dbUser,
    orgExists: !!dbUser?.organization,
    orgPlan: dbUser?.organization?.plan ?? null,
    hasStripeCustomer: !!dbUser?.organization?.stripeCustomerId,
    onboardingComplete: dbUser?.onboardingComplete ?? false,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
    stripeKeySet: !!process.env.STRIPE_SECRET_KEY,
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    upstashConfigured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    r2Configured: !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
  })
}
