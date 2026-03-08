import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { absoluteUrl } from '@/lib/utils'
import { getUserWithDetails } from '@/lib/user-service'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const dbUser = await getUserWithDetails(userId)
    const customerId = dbUser?.organization?.stripeCustomerId

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const isCancelFlow = body.flow === 'cancel'

    const sessionParams: any = {
      customer: customerId,
      return_url: absoluteUrl('/dashboard/billing'),
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
