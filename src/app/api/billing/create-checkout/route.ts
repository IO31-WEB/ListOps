import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { stripe, PLANS } from '@/lib/stripe'
import { absoluteUrl } from '@/lib/utils'
import { getUserWithDetails, getOrCreateUser } from '@/lib/user-service'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const RequestSchema = z.object({
  planId: z.enum(['starter', 'pro', 'brokerage']),
  billing: z.enum(['monthly', 'annual']),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use the actual request origin so Stripe redirects back to whichever domain
  // the user is on (preview URL, custom domain, etc) rather than the hardcoded APP_URL
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

  try {
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
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
