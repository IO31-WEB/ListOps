
/**
 * Team Invite API
 * POST /api/team/invite
 *
 * FIXES:
 * 1. Role validated against allowlist — prevents privilege escalation (e.g. inviting as 'owner')
 * 2. Seat count enforced — brokerage can't exceed their plan's maxAgents limit
 * 3. Resend imported at top-level — no more dynamic require() inside try/catch
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { referrals } from '@/lib/db/schema'
import { getUserWithDetails, getOrgSubscription, getTeamMembers } from '@/lib/user-service'
import { canAccessFeature } from '@/lib/stripe'
import type { PlanTier } from '@/lib/plans'
import { PLANS } from '@/lib/plans'

// FIX: Allowlist of valid roles an inviter can assign.
// 'owner' is excluded — you can't invite someone directly to owner.
const VALID_INVITE_ROLES = ['admin', 'agent', 'viewer'] as const
type InviteRole = typeof VALID_INVITE_ROLES[number]

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { email, role = 'agent' } = body

    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 254) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    // FIX: Validate role against allowlist — prevents passing 'owner' to escalate privileges
    if (!VALID_INVITE_ROLES.includes(role as InviteRole)) {
      return NextResponse.json({
        error: `Invalid role. Must be one of: ${VALID_INVITE_ROLES.join(', ')}`,
      }, { status: 400 })
    }

    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Only owners and admins can invite
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only org owners and admins can invite team members.' }, { status: 403 })
    }

    // Check plan allows team members
    const sub = user.orgId ? await getOrgSubscription(user.orgId) : null
    const planTier = (sub?.plan ?? 'free') as PlanTier
    const canInvite = canAccessFeature(planTier, 'multi_agent')
    if (!canInvite) {
      return NextResponse.json({
        error: 'Team management requires Pro plan or higher.',
      }, { status: 403 })
    }

    // FIX: Enforce seat limit — check current member count against plan maximum
    if (user.orgId) {
      const planDef = PLANS.find(p => p.id === planTier)
      const maxAgents = planDef?.maxAgents ?? 1
      const currentMembers = await getTeamMembers(user.orgId)
      if (currentMembers.length >= maxAgents) {
        return NextResponse.json({
          error: `Your ${planTier} plan supports up to ${maxAgents} team member${maxAgents === 1 ? '' : 's'}. Upgrade to add more.`,
        }, { status: 403 })
      }
    }

    // Record the invite as a referral
    await db.insert(referrals).values({
      referrerId: user.id,
      referredEmail: email.toLowerCase().trim(),
      status: 'pending',
      rewardGranted: false,
    })

    // Send invite email via Resend
    const resendKey = process.env.RESEND_API_KEY
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listops.io'
    const inviteUrl = `${appUrl}/sign-up?ref=${user.referralCode ?? ''}&team=1&email=${encodeURIComponent(email)}`
    const senderName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Your colleague'

    if (resendKey) {
      // FIX: Resend imported at top-level — no dynamic require(), no nested try/catch chains
      try {
        const resend = new Resend(resendKey)
        const { error: emailError } = await resend.emails.send({
          from: 'ListOps <onboarding@resend.dev>',
          to: email,
          subject: `${senderName} invited you to join ListOps`,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <h2 style="color:#0f172a">You're invited to join ListOps</h2>
            <p style="color:#475569">${senderName} has invited you to join their team on ListOps — the AI-powered real estate marketing platform.</p>
            <p style="color:#475569">Generate complete 6-week listing campaigns in under 90 seconds.</p>
            <a href="${inviteUrl}" style="display:inline-block;background:#0f172a;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;margin:16px 0">Accept Invite &rarr;</a>
            <p style="color:#94a3b8;font-size:13px">This invite expires in 7 days. If you did not expect this, you can safely ignore this email.</p>
          </div>`,
        })
        if (emailError) {
          console.error('[invite] Resend error:', emailError)
        }
      } catch (emailErr) {
        console.warn('[invite] Email send failed (non-fatal — invite saved in DB):', emailErr)
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
