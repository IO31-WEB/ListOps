import { z } from 'zod'
import { rateLimitBilling, rateLimitHeaders } from '@/lib/ratelimit'
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

  // Only trust Origin if it is our own domain or a Vercel preview (it becomes the post-portal redirect target).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const reqOrigin = request.headers.get('origin') || ''
  const origin = reqOrigin === appUrl || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(reqOrigin) ? reqOrigin : appUrl

  const rl = await rateLimitBilling(userId)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: rateLimitHeaders(rl) })

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

    if (dbUser.role !== 'owner') return NextResponse.json({ error: 'Only the account owner can manage billing.' }, { status: 403 })

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

    const body = z.object({ flow: z.literal('cancel').optional() }).safeParse(await request.json().catch(() => ({})))
    const isCancelFlow = body.success && body.data.flow === 'cancel'

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
