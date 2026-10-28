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
import { organizations, subscriptions, stripeEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { syncSubscription, downgradeToFree } from '@/lib/user-service'
import { enforceSeatLimits, markReferralsUpgraded } from '@/lib/team-invites'
import { trackPlanUpgraded } from '@/lib/posthog'
import { captureError } from '@/lib/monitoring'
import { planFromPriceId } from '@/lib/plans'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

const getPlanFromPriceId = planFromPriceId

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

  // IDEMPOTENCY: Stripe delivers events at-least-once (retries on timeouts / 5xx). Claim the event id first; if it
  // was already claimed, acknowledge without re-running side effects. The claim is released on failure (below) so
  // Stripe's retry still gets processed.
  const claimed = await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: stripeEvents.id })
  if (claimed.length === 0) return NextResponse.json({ received: true, duplicate: true })

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

        // Seats: single source of truth is SEAT_LIMITS (lib/plans.ts). Shrinking plans detach surplus members and revoke surplus invites.
        const seat = await enforceSeatLimits(org.id)
        if (seat.detached || seat.revoked) console.log(`[webhook] seat limits enforced for org ${org.id}: detached ${seat.detached}, revoked ${seat.revoked}`)

        // Referral conversion: a link referral becomes "upgraded" only when that person's own org has an ACTIVE paid subscription.
        if (plan !== 'free' && (sub.status === 'active' || sub.status === 'trialing')) await markReferralsUpgraded(org.id)

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
          await enforceSeatLimits(org.id) // plan is now free: 1 seat. Members are detached, pending invites revoked.
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
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id)).catch(() => {}) // release claim so the retry is processed
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

