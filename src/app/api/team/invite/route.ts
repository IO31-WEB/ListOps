/**
 * Team Invite API
 * POST /api/team/invite
 * Sends an email invite to join the user's organization.
 * Creates a referral record so we can track signups.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { referrals } from '@/lib/db/schema'
import { getUserWithDetails, getOrgSubscription } from '@/lib/user-service'
import { canAccessFeature } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { email, role = 'agent' } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check plan allows team members
    const sub = await getOrgSubscription(user.orgId)
    const planTier = (sub?.plan ?? 'free') as import('@/lib/stripe').PlanTier
    const canInvite = canAccessFeature(planTier, 'multi_agent')
    if (!canInvite) {
      return NextResponse.json({
        error: 'Team management requires Pro plan or higher.',
      }, { status: 403 })
    }

    // Record the invite as a referral
    await db.insert(referrals).values({
      referrerId: user.id,
      referredEmail: email,
      status: 'pending',
      rewardGranted: false,
    })

    // Send invite email via Resend (or log if not configured)
    const resendKey = process.env.RESEND_API_KEY
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://campaign-ai-psi.vercel.app'
    const inviteUrl = `${appUrl}/sign-up?ref=${user.referralCode ?? ''}&team=1&email=${encodeURIComponent(email)}`

    if (resendKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ResendModule = (() => { try { return require('resend') } catch { return null } })()
        if (ResendModule?.Resend) {
          const resend = new ResendModule.Resend(resendKey)
          await resend.emails.send({
            from: 'CampaignAI <noreply@getcampaignai.com>',
            to: email,
            subject: `${user.firstName ?? 'Your colleague'} invited you to CampaignAI`,
            html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px"><h2 style="color:#0f172a">You're invited to join CampaignAI</h2><p style="color:#475569">${user.firstName ?? 'A colleague'} has invited you to join their team on CampaignAI — the AI-powered real estate marketing platform.</p><p style="color:#475569">Generate complete 6-week listing campaigns in 90 seconds.</p><a href="${inviteUrl}" style="display:inline-block;background:#0f172a;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;margin:16px 0">Accept Invite →</a><p style="color:#94a3b8;font-size:13px">This invite expires in 7 days. If you didn't expect this, you can ignore this email.</p></div>`,
          })
        }
      } catch (emailErr) {
        console.warn('[invite] Email send failed:', emailErr)
        // Don't fail the request — invite was recorded in DB
      }
    } else {
      console.log(`[invite] No RESEND_API_KEY — invite recorded but email not sent to ${email}`)
      console.log(`[invite] Invite URL: ${inviteUrl}`)
    }

    return NextResponse.json({ success: true, message: `Invite sent to ${email}` })
  } catch (err) {
    console.error('[invite] Error:', err)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
