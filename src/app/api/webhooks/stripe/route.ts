import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { organizations, subscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { syncSubscription, downgradeToFree } from '@/lib/user-service'
import { trackPlanUpgraded } from '@/lib/posthog'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

function getPlanFromPriceId(priceId: string): 'starter' | 'pro' | 'brokerage' | 'enterprise' | 'free' {
  const map: Record<string, 'starter' | 'pro' | 'brokerage' | 'enterprise'> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || 'x']: 'starter',
    [process.env.STRIPE_STARTER_YEARLY_PRICE_ID || 'x']: 'starter',
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'x']: 'pro',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'x']: 'pro',
    [process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID || 'x']: 'brokerage',
    [process.env.STRIPE_BROKERAGE_YEARLY_PRICE_ID || 'x']: 'brokerage',
  }
  return map[priceId] ?? 'free'
}

// Find org by customer ID or subscription metadata — tries multiple strategies
async function findOrg(customerId: string, metaOrgId?: string) {
  if (metaOrgId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, metaOrgId),
    })
    if (org) return org
  }

  // Fallback: find by stripe customer ID
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customerId),
  })
  if (org) return org

  // Last resort: update customer ID then retry
  await db.update(organizations)
    .set({ stripeCustomerId: customerId })
    .where(eq(organizations.stripeCustomerId, null as any))
  
  return db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customerId),
  })
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
          console.error('checkout.session.completed: missing orgId in metadata')
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

        const org = await findOrg(customerId, metaOrgId)

        if (!org) {
          console.error(`No org found for customer ${customerId}`)
          // Return 200 so Stripe doesn't keep retrying for unknown customers
          break
        }

        // Make sure customer ID is saved
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
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })

        const agentLimits: Record<string, number> = {
          starter: 1, pro: 3, brokerage: 25, enterprise: 999,
        }
        await db.update(organizations)
          .set({ maxAgents: agentLimits[plan] ?? 1 })
          .where(eq(organizations.id, org.id))

        console.log(`✅ Plan updated to ${plan} for org ${org.id}`)

        // PostHog: track plan change for retention analytics
        if (org.id) {
          const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'annual' : 'monthly'
          trackPlanUpgraded({
            userId: org.id,
            fromPlan: org.plan ?? 'free',
            toPlan: plan,
            billingInterval: interval,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const org = await findOrg(sub.customer as string, sub.metadata?.orgId)
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
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Log full error details
    if (err instanceof Error) {
      console.error('Error message:', err.message)
      console.error('Error stack:', err.stack)
    }
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
