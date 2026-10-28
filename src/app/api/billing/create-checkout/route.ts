import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { stripe, PLANS } from '@/lib/stripe'
import { absoluteUrl } from '@/lib/utils'
import { getUserWithDetails, getOrCreateUser } from '@/lib/user-service'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { assertAdult } from '@/lib/age'
import { logAudit } from '@/lib/audit'
import { rateLimitBilling, rateLimitHeaders } from '@/lib/ratelimit'
import { ApiError, handleApiError } from '@/lib/api-utils'
import { renewalSummary } from '@/components/billing/renewal-notice'

const RequestSchema = z.object({
  planId: z.enum(['starter', 'pro', 'commercial', 'brokerage']),
  billing: z.enum(['monthly', 'annual']),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use the actual request origin so Stripe redirects back to whichever domain
  // the user is on (preview URL, custom domain, etc) rather than the hardcoded APP_URL
  // Only trust the Origin header if it is our own domain or a Vercel preview — otherwise an attacker-controlled
  // Origin could become the post-payment redirect target.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const reqOrigin = request.headers.get('origin') || ''
  const origin = reqOrigin === appUrl || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(reqOrigin) ? reqOrigin : appUrl

  try {
    const rl = await rateLimitBilling(userId)
    if (!rl.success) return NextResponse.json({ error: 'Too many checkout attempts. Please try again later.' }, { status: 429, headers: rateLimitHeaders(rl) })

    const body = await request.json()
    const { planId, billing } = RequestSchema.parse(body)

    const clerkUser = await currentUser()
    if (!clerkUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    // Get or auto-create the user in DB (handles users who signed up before webhook was configured)
    let dbUser = await getUserWithDetails(userId)
    if (!dbUser) {
      const primaryEmail = clerkUser.emailAddresses.find(
        e => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

      if (!primaryEmail) return NextResponse.json({ error: 'No email found' }, { status: 400 })

      await getOrCreateUser(userId, {
        email: primaryEmail,
        firstName: clerkUser.firstName ?? undefined,
        lastName: clerkUser.lastName ?? undefined,
        avatarUrl: clerkUser.imageUrl ?? undefined,
      })
      dbUser = await getUserWithDetails(userId)
    }

    if (!dbUser?.organization) {
      return NextResponse.json({ error: 'Could not create organization. Please contact support.' }, { status: 400 })
    }

    assertAdult(dbUser)

    // Plans are bought by the account OWNER for the whole organization. A teammate must never attach a subscription to (or change) the team's billing.
    if (dbUser.role !== 'owner') {
      return NextResponse.json({ error: 'Only the account owner can change the plan. Ask your team owner.' }, { status: 403 })
    }

    const plan = PLANS.find(p => p.id === planId)
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const priceId = billing === 'annual' ? plan.yearlyPriceId : plan.monthlyPriceId
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const org = dbUser.organization
    let customerId = org.stripeCustomerId

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clerkUser.emailAddresses[0]?.emailAddress ?? dbUser.email,
        name: `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim() || dbUser.email,
        metadata: { orgId: org.id, clerkUserId: userId },
      })
      customerId = customer.id

      await db.update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, org.id))
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing?success=true`,
      cancel_url: `${origin}/dashboard/billing?canceled=true`,
      metadata: { orgId: org.id, clerkUserId: userId, planId, billing },
      subscription_data: {
        ...(planId === 'brokerage' ? { trial_period_days: 14 } : {}),
        metadata: { orgId: org.id, clerkUserId: userId, planId },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      // Renewal terms shown on Stripe's hosted payment page, right above the Pay/Subscribe button.
      custom_text: {
        submit: {
          message: renewalSummary({
            planName: plan.name,
            price: billing === 'annual' ? (plan.yearlyPrice ?? 0) : (plan.monthlyPrice ?? 0),
            interval: billing === 'annual' ? 'year' : 'month',
            trialDays: planId === 'brokerage' ? 14 : undefined,
          }).slice(0, 1200),
        },
      },
      // Optional explicit "I agree to the Terms" checkbox at checkout. Requires the Terms URL to be set in
      // Stripe Dashboard → Settings → Public details, so it is opt-in via env to avoid a 400 from Stripe.
      ...(process.env.STRIPE_REQUIRE_TOS === 'true' ? { consent_collection: { terms_of_service: 'required' as const } } : {}),
    }, {
      // DOUBLE-SUBMIT PROTECTION: a double-click / retry within the same minute gets the SAME Checkout Session back
      // from Stripe instead of creating a second one.
      idempotencyKey: `checkout:${userId}:${planId}:${billing}:${Math.floor(Date.now() / 60_000)}`,
    })

    await logAudit({ action: 'billing.checkout_started', actorClerkId: userId, targetUserId: dbUser.id, request, metadata: { planId, billing } })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    if (err instanceof ApiError) return handleApiError(err)
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
