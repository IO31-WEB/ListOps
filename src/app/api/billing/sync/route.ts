/**
 * Billing Sync API
 * GET/POST /api/billing/sync
 * Force-syncs subscription status directly from Stripe to DB.
 * Called after cancellation, upgrade, or any billing change.
 */

import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { subscriptions, organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import type { PlanTier } from '@/lib/stripe'

async function syncFromStripe(userId: string): Promise<PlanTier> {
  const user = await getUserWithDetails(userId)
  if (!user) return 'free'

  const customerId = user.organization?.stripeCustomerId
  if (!customerId) return 'free'

  // Get active subscriptions directly from Stripe
  const stripeSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
    expand: ['data.items.data.price'],
  })

  if (!stripeSubs.data.length) {
    // No active sub — downgrade to free
    await db.update(subscriptions)
      .set({ plan: 'free', status: 'canceled', updatedAt: new Date() })
      .where(eq(subscriptions.orgId, user.orgId!))
    await db.update(organizations)
      .set({ plan: 'free', updatedAt: new Date() })
      .where(eq(organizations.id, user.orgId!))

    // Sync Clerk metadata
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { planTier: 'free' },
    })
    return 'free'
  }

  const sub = stripeSubs.data[0]
  const priceId = sub.items.data[0]?.price?.id

  // Map price ID to plan tier
  const PRICE_TO_PLAN: Record<string, PlanTier> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? '']: 'starter',
    [process.env.STRIPE_STARTER_YEARLY_PRICE_ID ?? '']: 'starter',
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '']: 'pro',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? '']: 'pro',
    [process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID ?? '']: 'brokerage',
    [process.env.STRIPE_BROKERAGE_YEARLY_PRICE_ID ?? '']: 'brokerage',
  }

  const planTier: PlanTier = (priceId && PRICE_TO_PLAN[priceId]) ? PRICE_TO_PLAN[priceId] : 'free'

  // Update DB
  await db.update(subscriptions)
    .set({
      plan: planTier,
      status: sub.status as any,
      stripeSubscriptionId: sub.id,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.orgId, user.orgId!))

  await db.update(organizations)
    .set({ plan: planTier, updatedAt: new Date() })
    .where(eq(organizations.id, user.orgId!))

  // Sync Clerk metadata
  const clerk = await clerkClient()
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { planTier },
  })

  return planTier
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const planTier = await syncFromStripe(userId)
  return NextResponse.json({ planTier, synced: true, message: `Synced from Stripe: ${planTier}` })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const planTier = await syncFromStripe(userId)
  return NextResponse.json({ planTier, synced: true })
}
