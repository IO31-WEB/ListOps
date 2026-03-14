import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { getUserWithDetails, getOrCreateUser } from '@/lib/user-service'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

  try {
    const clerkUser = await currentUser()
    if (!clerkUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    // Ensure DB user exists (handles edge cases where webhook was missed)
    let dbUser = await getUserWithDetails(userId)
    if (!dbUser) {
      const primaryEmail =
        clerkUser.emailAddresses.find((e: any) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress
      if (primaryEmail) {
        await getOrCreateUser(userId, {
          email: primaryEmail,
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
        })
        dbUser = await getUserWithDetails(userId)
      }
    }

    if (!dbUser?.organization) {
      return NextResponse.json({ error: 'Could not find your account. Please contact support.' }, { status: 400 })
    }

    let customerId = dbUser.organization.stripeCustomerId

    // Auto-create Stripe customer if missing — users who downgrade or were on free
    // may not have a customerId yet if they never completed a checkout.
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clerkUser.emailAddresses[0]?.emailAddress ?? dbUser.email,
        name: `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim() || dbUser.email,
        metadata: { orgId: dbUser.organization.id, clerkUserId: userId },
      })
      customerId = customer.id
      await db.update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, dbUser.organization.id))
    }

    const body = await request.json().catch(() => ({}))
    const isCancelFlow = body.flow === 'cancel'

    const sessionParams: any = {
      customer: customerId,
      return_url: `${origin}/dashboard/billing`,
    }

    if (isCancelFlow) {
      // Get the active subscription to target it directly
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })
      const subId = subs.data[0]?.id
      if (subId) {
        sessionParams.flow_data = {
          type: 'subscription_cancel',
          subscription_cancel: { subscription: subId },
        }
      }
    }

    const session = await stripe.billingPortal.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Billing portal error:', err)
    return NextResponse.json({ error: 'Could not open billing portal' }, { status: 500 })
  }
}
