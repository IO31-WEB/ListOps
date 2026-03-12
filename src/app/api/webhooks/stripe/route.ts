/**
 * Stripe Webhook Handler
 *
 * FIXES APPLIED:
 * 1. Removed the "update first org with null customerId" fallback in findOrg()
 *    — that logic could silently assign a payment to the wrong organization
 *      when Stripe fires subscription.created before checkout.session.completed
 *    — now: if org can't be resolved, we log the error and return 200 (no retry)
 * 2. captureError() called for all unresolvable org cases (Sentry alert)
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { organizations, subscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { syncSubscription, downgradeToFree } from '@/lib/user-service'
import { trackPlanUpgraded } from '@/lib/posthog'
import { captureError } from '@/lib/monitoring'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

function getPlanFromPriceId(priceId: string): 'starter' | 'pro' | 'commercial' | 'brokerage' | 'enterprise' | 'free' {
  const map: Record<string, 'starter' | 'pro' | 'commercial' | 'brokerage' | 'enterprise'> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '__unset__']: 'starter',
    [process.env.STRIPE_STARTER_YEARLY_PRICE_ID  || '__unset__']: 'starter',
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID     || '__unset__']: 'pro',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID      || '__unset__']: 'pro',
    [process.env.STRIPE_COMMERCIAL_MONTHLY_PRICE_ID || '__unset__']: 'commercial',
    [process.env.STRIPE_COMMERCIAL_YEARLY_PRICE_ID  || '__unset__']: 'commercial',
    [process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID || '__unset__']: 'brokerage',
    [process.env.STRIPE_BROKERAGE_YEARLY_PRICE_ID  || '__unset__']: 'brokerage',
  }
  return map[priceId] ?? 'free'
}

/**
 * FIX: Resolve org from webhook event using only reliable strategies.
 *
 * REMOVED: the previous "last resort" fallback that did:
 *   UPDATE organizations SET stripe_customer_id = $1 WHERE stripe_customer_id IS NULL
 * That query would match ANY org with no customer ID and assign someone else's
 * payment to them — a billing attribution bug that silently gave random users paid access.
 *
 * Safe strategies only:
 *   1. metadata.orgId (set at checkout creation — most reliable)
 *   2. stripeCustomerId column match
 */
async function findOrgByEvent(
  customerId: string,
  metaOrgId?: string
): Promise<typeof organizations.$inferSelect | null> {
  // Strategy 1: trust the metadata orgId we wrote at checkout session creation
  if (metaOrgId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, metaOrgId),
    })
    if (org) return org
    // Metadata orgId present but not found in DB — data integrity problem
    captureError(new Error(`[webhook] metadata orgId ${metaOrgId} not found in DB`), {
      metaOrgId,
      customerId,
    })
  }

  // Strategy 2: customer ID column lookup
  if (customerId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.stripeCustomerId, customerId),
    })
    if (org) return org
  }

  // Cannot resolve — log for investigation, do NOT modify random orgs
  captureError(new Error(`[webhook] Cannot resolve org — no metadata orgId and no customer ID match`), {
    customerId,
    metaOrgId,
  })
  return null
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { orgId, planId } = session.metadata || {}

        if (!orgId) {
          captureError(new Error('[webhook] checkout.session.completed: missing orgId in metadata'), {
            sessionId: session.id,
          })
          break
        }

        if (session.customer) {
          await db.update(organizations)
            .set({ stripeCustomerId: session.customer as string })
            .where(eq(organizations.id, orgId))
        }

        console.log(`✅ Checkout complete — org: ${orgId}, plan: ${planId}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const metaOrgId = sub.metadata?.orgId
        const customerId = sub.customer as string

        const org = await findOrgByEvent(customerId, metaOrgId)

        if (!org) {
          // Already logged by findOrgByEvent — return 200 so Stripe stops retrying
          console.error(`[webhook] Unresolvable org for customer ${customerId} — skipping sync`)
          break
        }

        // Ensure customer ID is persisted
        if (!org.stripeCustomerId) {
          await db.update(organizations)
            .set({ stripeCustomerId: customerId })
            .where(eq(organizations.id, org.id))
        }

        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan = getPlanFromPriceId(priceId)

        console.log(`📋 Syncing subscription — org: ${org.id}, plan: ${plan}, priceId: ${priceId}`)

        await syncSubscription(org.id, {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          plan,
          status: sub.status as any,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })

        const agentLimits: Record<string, number> = {
          starter: 1, pro: 3, brokerage: 25, enterprise: 999,
        }
        await db.update(organizations)
          .set({ maxAgents: agentLimits[plan] ?? 1 })
          .where(eq(organizations.id, org.id))

        console.log(`✅ Plan updated to ${plan} for org ${org.id}`)

        const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'annual' : 'monthly'
        trackPlanUpgraded({
          userId: org.id,
          fromPlan: org.plan ?? 'free',
          toPlan: plan,
          billingInterval: interval,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const org = await findOrgByEvent(sub.customer as string, sub.metadata?.orgId)
        if (org) {
          await downgradeToFree(org.id)
          console.log(`❌ Subscription canceled, org ${org.id} downgraded to free`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, invoice.customer as string),
        })
        if (org) {
          await db.update(subscriptions)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(subscriptions.orgId, org.id))
        }
        console.log(`💳 Payment succeeded: ${invoice.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, invoice.customer as string),
        })
        if (org) {
          await db.update(subscriptions)
            .set({ status: 'past_due', updatedAt: new Date() })
            .where(eq(subscriptions.orgId, org.id))
        }
        console.warn(`⚠️ Payment failed: ${invoice.id}`)
        break
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription
        console.log(`⏰ Trial ending soon: ${sub.id}`)
        // TODO: trigger dunning email via Resend
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    captureError(err, { eventType: event.type, eventId: event.id })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

