/**
 * Team Invite API
 *   POST   /api/team/invite   { email, role }  -> create a seat invite and email the link
 *   GET    /api/team/invite                    -> seat usage + live invites (owner/admin)
 *   DELETE /api/team/invite   { id }           -> revoke a live invite (frees the seat)
 *
 * All rules (plan gate, hard seat limit counting members + live invites, role allow-list, per-org daily cap, single-use
 * hashed email-bound token) live in lib/team-invites.ts. Seat limits come from SEAT_LIMITS in lib/plans.ts.
 */
import { z } from 'zod'
import { assertSameOrigin } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sendEmail, escapeHtml, oneLine } from '@/lib/email'
import { rateLimitInvite, rateLimitHeaders } from '@/lib/ratelimit'
import { logAudit } from '@/lib/audit'
import { getUserWithDetails } from '@/lib/user-service'
import { resolvePlan } from '@/lib/plan-resolve'
import { createTeamInvite, getSeatState, listPendingInvites, revokeTeamInvite } from '@/lib/team-invites'
import { INVITE_ROLES, INVITE_TTL_DAYS } from '@/lib/team-invite-rules'

const InviteBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.string().default('agent').refine(r => (INVITE_ROLES as readonly string[]).includes(r)),
})
const RevokeBody = z.object({ id: z.string().uuid() })

/** CSRF defence for cookie-authenticated mutations: the Origin header must match this host. */
function crossOrigin(req: Request): NextResponse | null {
  try { assertSameOrigin(req); return null } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
}

async function requireManager() {
  const { userId } = await auth()
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  const user = await getUserWithDetails(userId)
  if (!user) return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) } as const
  if (user.deletedAt || user.ageBlockedAt) return { error: NextResponse.json({ error: 'Account unavailable' }, { status: 403 }) } as const
  if (user.role !== 'owner' && user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Only org owners and admins can manage team invites.' }, { status: 403 }) } as const
  }
  return { userId, user } as const
}

export async function GET() {
  const r = await requireManager()
  if ('error' in r) return r.error
  const { user } = r
  if (!user.orgId) return NextResponse.json({ error: 'No organization' }, { status: 404 })
  const plan = resolvePlan(user)
  const [seats, invites] = await Promise.all([getSeatState(user.orgId, plan), listPendingInvites(user.orgId)])
  return NextResponse.json({ plan, seats, invites })
}

export async function POST(req: NextRequest) {
  const bad = crossOrigin(req)
  if (bad) return bad
  const r = await requireManager()
  if ('error' in r) return r.error
  const { userId, user } = r

  try {
    // Invites send real email to third parties — cap per user per day so this can't be used to spam.
    const rl = await rateLimitInvite(userId)
    if (!rl.success) return NextResponse.json({ error: 'Daily invite limit reached. Please try again tomorrow.' }, { status: 429, headers: rateLimitHeaders(rl) })

    const parsed = InviteBody.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      const roleBad = parsed.error.issues.some(i => i.path[0] === 'role')
      return NextResponse.json({ error: roleBad ? `Invalid role. Must be one of: ${INVITE_ROLES.join(', ')}` : 'Valid email required' }, { status: 400 })
    }
    const { email, role } = parsed.data

    const result = await createTeamInvite(user as any, email, role)
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listops.io'
    // The token only ever travels in this link. It is single-use, bound to this email address and expires.
    const inviteUrl = `${appUrl}/invite/${result.token}`
    const senderName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Your colleague'

    let delivered = false
    if (process.env.RESEND_API_KEY) {
      const safeSender = escapeHtml(senderName)
      const safeUrl = escapeHtml(inviteUrl)
      const sent = await sendEmail({
        kind: 'transactional',
        to: email,
        fromName: 'ListOps',
        replyTo: user.email,
        subject: `${oneLine(senderName, 60)} invited you to join their ListOps team`,
        text: `${senderName} has invited you to join their team on ListOps.\n\nAccept the invite (use this email address: ${email}): ${inviteUrl}\n\nThis link works once and expires in ${INVITE_TTL_DAYS} days. If you did not expect it, ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <h2 style="color:#0f172a">You're invited to join a ListOps team</h2>
            <p style="color:#475569">${safeSender} has invited you to join their team on ListOps. Sign up or sign in with <strong>${escapeHtml(email)}</strong> to accept.</p>
            <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;margin:16px 0">Accept invite</a>
            <p style="color:#94a3b8;font-size:13px">This link works once and expires in ${INVITE_TTL_DAYS} days. If you did not expect this, you can safely ignore this email.</p>
          </div>`,
        reason: `You received this because ${senderName} entered your email address to invite you.`,
        tags: [{ name: 'kind', value: 'team_invite' }],
      })
      delivered = sent.ok
      if (!sent.ok) console.error('[invite] email not sent:', sent.reason)
    } else {
      console.log(`[invite] No RESEND_API_KEY — invite recorded but email not sent to ${email}`)
    }

    await logAudit({ action: 'team.invite_sent', actorClerkId: userId, targetUserId: user.id, request: req, metadata: { inviteeDomain: email.split('@')[1], role, delivered } })

    // If email could not be delivered the owner gets the link to share manually (it is bound to the invited address anyway).
    return NextResponse.json({
      success: true,
      message: delivered ? `Invite sent to ${email}` : `Invite created for ${email}, but the email could not be sent. Share this link with them directly.`,
      delivered,
      ...(delivered ? {} : { inviteUrl }),
      seats: result.seats,
    })
  } catch (err) {
    console.error('[invite] Error:', err)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const bad = crossOrigin(req)
  if (bad) return bad
  const r = await requireManager()
  if ('error' in r) return r.error
  const { userId, user } = r
  const parsed = RevokeBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !user.orgId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const ok = await revokeTeamInvite(user.orgId, parsed.data.id)
  if (!ok) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  await logAudit({ action: 'team.invite_revoked', actorClerkId: userId, targetUserId: user.id, request: req, resourceType: 'team_invite', resourceId: parsed.data.id })
  return NextResponse.json({ success: true })
}
