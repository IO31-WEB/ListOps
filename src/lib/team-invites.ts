/**
 * Team seat invites — the DB-backed flow.
 *
 *   create  (owner/admin)  -> hard seat check (members + live invites), role check, per-org daily cap, hashed single-use token
 *   accept  (invitee)      -> verified-email match, plan must still be active, seat re-check, atomic attach to the inviting org
 *   remove  (owner/admin)  -> member is detached to their own free workspace (frees the seat)
 *   enforce (billing event)-> when a plan shrinks, extra members are detached; pending invites over the limit are revoked
 *
 * The invitee never carries a plan of their own: they join the inviter's ORGANIZATION and lib/plan-resolve.ts decides what
 * they may use, so access stops the moment the owner's subscription is not active/trialing.
 * No interactive transactions on neon-http: every state change is a single conditional statement, with a compensating
 * revert where a second statement can fail.
 */
import { and, asc, count, desc, eq, gt, isNull, ne, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs, brandKits, campaigns, listings, organizations, referrals, subscriptions, teamInvites, users } from '@/lib/db/schema'
import { canAccess, seatLimitFor, type PlanTier } from '@/lib/plans'
import { isEntitlingStatus, resolvePlan } from '@/lib/plan-resolve'
import { slugify } from '@/lib/utils'
import { captureError } from '@/lib/monitoring'
import {
  MAX_INVITES_PER_ORG_PER_DAY, canInviteRole, emailsMatch, generateInviteToken, hashInviteToken, inviteExpiry,
  isPlausibleToken, membersToDetach, normalizeEmail, seatState, type InviteRole, type SeatState,
} from '@/lib/team-invite-rules'

type Fail = { ok: false; status: number; code: string; error: string }
const fail = (status: number, code: string, error: string): Fail => ({ ok: false, status, code, error })

// ── Counting ───────────────────────────────────────────────────

export async function countMembers(orgId: string): Promise<number> {
  const [r] = await db.select({ c: count() }).from(users).where(and(eq(users.orgId, orgId), isNull(users.deletedAt)))
  return Number(r?.c ?? 0)
}

export async function countPendingInvites(orgId: string, exceptEmail?: string): Promise<number> {
  const [r] = await db.select({ c: count() }).from(teamInvites).where(and(
    eq(teamInvites.orgId, orgId), eq(teamInvites.status, 'pending'), gt(teamInvites.expiresAt, new Date()),
    exceptEmail ? ne(teamInvites.email, exceptEmail) : undefined,
  ))
  return Number(r?.c ?? 0)
}

export async function getSeatState(orgId: string, plan: string): Promise<SeatState> {
  const [members, pending] = await Promise.all([countMembers(orgId), countPendingInvites(orgId)])
  return seatState(plan, members, pending)
}

export async function listPendingInvites(orgId: string) {
  return db.select({ id: teamInvites.id, email: teamInvites.email, role: teamInvites.role, expiresAt: teamInvites.expiresAt, createdAt: teamInvites.createdAt })
    .from(teamInvites)
    .where(and(eq(teamInvites.orgId, orgId), eq(teamInvites.status, 'pending'), gt(teamInvites.expiresAt, new Date())))
    .orderBy(desc(teamInvites.createdAt))
}

// ── Create ─────────────────────────────────────────────────────

export interface Inviter {
  id: string; orgId: string | null; role: string; email: string
  organization?: { plan?: string | null; subscriptions?: Array<{ plan?: string | null; status?: string | null }> | null } | null
}

export async function createTeamInvite(inviter: Inviter, rawEmail: string, role: string):
  Promise<{ ok: true; token: string; inviteId: string; expiresAt: Date; seats: SeatState } | Fail> {
  const email = normalizeEmail(rawEmail)
  if (!inviter.orgId) return fail(403, 'no_org', 'Your account is not part of an organization.')
  if (!canInviteRole(inviter.role, role)) return fail(403, 'role', inviter.role === 'admin' && role === 'admin'
    ? 'Only the account owner can invite another admin.' : 'Only owners and admins can invite, and only as admin, agent or viewer.')

  // Plan: team seats are a paid feature AND the subscription must currently be in good standing (a past_due owner cannot add people).
  const plan = resolvePlan(inviter as any) as PlanTier
  const status = inviter.organization?.subscriptions?.[0]?.status ?? 'active'
  if (!canAccess(plan, 'team_seats')) return fail(403, 'plan', 'Team seats require the Pro plan or higher.')
  if (!isEntitlingStatus(status)) return fail(403, 'billing', 'Your subscription needs attention before you can add teammates. Update your payment method in Billing.')

  if (emailsMatch(email, inviter.email)) return fail(400, 'self', 'That is your own email address.')

  // HARD seat limit: members + live invites (excluding a re-invite of the same address, which replaces its own invite).
  const [members, pending] = await Promise.all([countMembers(inviter.orgId), countPendingInvites(inviter.orgId, email)])
  const seats = seatState(plan, members, pending)
  if (seats.full) {
    return fail(403, 'seats_full', `Your ${plan} plan includes ${seats.limit} seat${seats.limit === 1 ? '' : 's'} and ${seats.used} ${seats.used === 1 ? 'is' : 'are'} in use (members plus pending invites). Remove a member or revoke an invite, or upgrade for more seats.`)
  }

  const already = await db.query.users.findFirst({ where: and(eq(users.orgId, inviter.orgId), isNull(users.deletedAt), sql`lower(${users.email}) = ${email}`), columns: { id: true } })
  if (already) return fail(409, 'member', 'That person is already on your team.')

  // Invite-farming guard: cap invites created per organization per rolling 24h (revoked ones count).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [recent] = await db.select({ c: count() }).from(teamInvites).where(and(eq(teamInvites.orgId, inviter.orgId), gt(teamInvites.createdAt, since)))
  if (Number(recent?.c ?? 0) >= MAX_INVITES_PER_ORG_PER_DAY) return fail(429, 'daily_cap', 'Daily invite limit reached for your team. Try again tomorrow.')

  // Re-invite: supersede any earlier live invite to the same address (old link stops working).
  await db.update(teamInvites).set({ status: 'revoked' })
    .where(and(eq(teamInvites.orgId, inviter.orgId), eq(teamInvites.email, email), eq(teamInvites.status, 'pending')))

  const token = generateInviteToken()
  const expiresAt = inviteExpiry()
  const [row] = await db.insert(teamInvites).values({
    orgId: inviter.orgId, inviterId: inviter.id, email, role: role as InviteRole, tokenHash: hashInviteToken(token), expiresAt,
  }).returning({ id: teamInvites.id })

  // Referral bookkeeping: one row per (referrer, email) for seat invites; it moves to signed_up when the invite is accepted.
  const existing = await db.query.referrals.findFirst({ where: and(eq(referrals.referrerId, inviter.id), eq(referrals.referredEmail, email), eq(referrals.source, 'team')), columns: { id: true } })
  if (!existing) await db.insert(referrals).values({ referrerId: inviter.id, referredEmail: email, status: 'pending', rewardGranted: false, source: 'team' })

  return { ok: true, token, inviteId: row.id, expiresAt, seats: { ...seats, pending: seats.pending + 1, used: seats.used + 1, remaining: Math.max(0, seats.remaining - 1), full: seats.used + 1 >= seats.limit } }
}

// ── Lookup (public landing page) ───────────────────────────────

export async function describeInvite(token: string) {
  if (!isPlausibleToken(token)) return null
  const inv = await db.query.teamInvites.findFirst({ where: eq(teamInvites.tokenHash, hashInviteToken(token)) })
  if (!inv) return null
  const [org, inviter] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, inv.orgId), columns: { name: true } }),
    db.query.users.findFirst({ where: eq(users.id, inv.inviterId), columns: { firstName: true, lastName: true } }),
  ])
  const usable = inv.status === 'pending' && inv.expiresAt > new Date()
  return {
    usable, status: inv.status, email: inv.email, role: inv.role, orgName: org?.name ?? 'a ListOps team',
    inviterName: [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ') || 'A colleague',
  }
}

// ── Accept ─────────────────────────────────────────────────────

export interface Joiner { id: string; orgId: string | null; email: string; deletedAt: Date | null; ageBlockedAt: Date | null }

export async function acceptTeamInvite(joiner: Joiner, verifiedEmail: string | null, token: string):
  Promise<{ ok: true; orgId: string; plan: PlanTier; already?: boolean } | Fail> {
  if (!isPlausibleToken(token)) return fail(404, 'invalid', 'This invite link is not valid.')
  if (joiner.deletedAt || joiner.ageBlockedAt) return fail(403, 'account', 'This account cannot join a team.')

  const inv = await db.query.teamInvites.findFirst({ where: eq(teamInvites.tokenHash, hashInviteToken(token)) })
  if (!inv) return fail(404, 'invalid', 'This invite link is not valid.')
  if (joiner.orgId === inv.orgId && inv.status === 'accepted' && inv.acceptedUserId === joiner.id) {
    return { ok: true, orgId: inv.orgId, plan: 'free', already: true } // idempotent revisit
  }
  if (inv.status === 'revoked') return fail(410, 'revoked', 'This invite was cancelled. Ask your team owner to send a new one.')
  if (inv.status === 'accepted') return fail(410, 'used', 'This invite has already been used.')
  if (inv.expiresAt <= new Date()) return fail(410, 'expired', 'This invite has expired. Ask your team owner to send a new one.')

  // Email-bound: the signed-in, VERIFIED address must be the one that was invited. A forwarded link is useless to anyone else.
  if (!verifiedEmail || !emailsMatch(verifiedEmail, inv.email)) {
    return fail(403, 'email_mismatch', `This invite was sent to ${inv.email}. Sign in or sign up with that verified email address to accept it.`)
  }

  // The inviting team must still be in good standing and the inviter still entitled to add people.
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, inv.orgId), with: { subscriptions: true } })
  const inviter = await db.query.users.findFirst({ where: eq(users.id, inv.inviterId), columns: { role: true, orgId: true, deletedAt: true } })
  if (!org || !inviter || inviter.deletedAt || inviter.orgId !== inv.orgId || !['owner', 'admin'].includes(inviter.role)) {
    return fail(410, 'inviter_gone', 'This invite is no longer valid.')
  }
  const plan = resolvePlan({ role: 'agent', organization: org }) // what a MEMBER of this org gets right now
  if (plan === 'free') return fail(402, 'plan_inactive', 'This team does not currently have an active paid plan, so the invite cannot be accepted. Ask the team owner to check their billing.')
  const limit = seatLimitFor(plan)

  // Joiner must not be abandoning a paid workspace or a team: only a solo, free workspace can be folded in.
  if (!joiner.orgId) return fail(409, 'no_workspace', 'Finish setting up your account, then open the invite link again.')
  const oldOrg = await db.query.organizations.findFirst({ where: eq(organizations.id, joiner.orgId), with: { subscriptions: true } })
  const oldMembers = await countMembers(joiner.orgId)
  if (oldMembers > 1 || (oldOrg && resolvePlan({ role: 'owner', organization: oldOrg }) !== 'free')) {
    return fail(409, 'has_workspace', 'Your account already belongs to a paid plan or a team. Cancel that plan or leave that team first, then accept this invite.')
  }

  // 1) Claim the invite atomically (single use) …
  const claimed = await db.update(teamInvites)
    .set({ status: 'accepted', acceptedUserId: joiner.id, acceptedAt: new Date() })
    .where(and(eq(teamInvites.id, inv.id), eq(teamInvites.status, 'pending'), gt(teamInvites.expiresAt, new Date())))
    .returning({ id: teamInvites.id })
  if (claimed.length === 0) return fail(410, 'used', 'This invite has already been used.')

  const unclaim = () => db.update(teamInvites).set({ status: 'pending', acceptedUserId: null, acceptedAt: null }).where(eq(teamInvites.id, inv.id))

  try {
    // 2) … then attach, only if a seat is still free (single conditional UPDATE).
    const attached = await db.update(users)
      .set({ orgId: inv.orgId, role: inv.role, updatedAt: new Date() })
      .where(and(
        eq(users.id, joiner.id), eq(users.orgId, joiner.orgId),
        sql`(select count(*) from users u2 where u2.org_id = ${inv.orgId} and u2.deleted_at is null) < ${limit}`,
      ))
      .returning({ id: users.id })
    if (attached.length === 0) { await unclaim(); return fail(403, 'seats_full', 'This team has no free seats right now. Ask the owner to free one up.') }

    // Race re-check: two simultaneous accepts must not both squeeze past the limit.
    if ((await countMembers(inv.orgId)) > limit) {
      await db.update(users).set({ orgId: joiner.orgId, role: 'owner', updatedAt: new Date() }).where(eq(users.id, joiner.id))
      await unclaim()
      return fail(403, 'seats_full', 'This team has no free seats right now. Ask the owner to free one up.')
    }
  } catch (err) {
    await unclaim().catch(() => {})
    captureError(err, { context: 'team_invite_attach' })
    return fail(500, 'error', 'Could not join the team. Please try again.')
  }

  // 3) Housekeeping (best effort — the user is already attached, so none of this may undo that).
  try {
    await Promise.all([
      db.update(brandKits).set({ orgId: inv.orgId }).where(eq(brandKits.userId, joiner.id)),
      db.update(campaigns).set({ orgId: inv.orgId }).where(eq(campaigns.agentId, joiner.id)),
      db.update(listings).set({ orgId: inv.orgId }).where(eq(listings.agentId, joiner.id)),
      db.update(auditLogs).set({ orgId: inv.orgId }).where(eq(auditLogs.orgId, joiner.orgId)),
    ])
    if ((await countMembers(joiner.orgId)) === 0) await db.delete(organizations).where(eq(organizations.id, joiner.orgId))
  } catch (err) { captureError(err, { context: 'team_invite_cleanup' }) }

  try {
    const updated = await db.update(referrals).set({ referredUserId: joiner.id, status: 'signed_up' })
      .where(and(eq(referrals.referrerId, inv.inviterId), eq(referrals.referredEmail, inv.email), eq(referrals.source, 'team'), eq(referrals.status, 'pending')))
      .returning({ id: referrals.id })
    if (updated.length === 0) {
      await db.insert(referrals).values({ referrerId: inv.inviterId, referredUserId: joiner.id, referredEmail: inv.email, status: 'signed_up', rewardGranted: false, source: 'team' })
    }
  } catch (err) { captureError(err, { context: 'team_invite_referral' }) }

  return { ok: true, orgId: inv.orgId, plan }
}

// ── Revoke / remove ────────────────────────────────────────────

export async function revokeTeamInvite(orgId: string, inviteId: string): Promise<boolean> {
  const r = await db.update(teamInvites).set({ status: 'revoked' })
    .where(and(eq(teamInvites.id, inviteId), eq(teamInvites.orgId, orgId), eq(teamInvites.status, 'pending')))
    .returning({ id: teamInvites.id })
  return r.length > 0
}

/** Move a user into a brand-new free solo workspace (used when removing a member or shrinking seats). */
export async function detachToOwnWorkspace(user: { id: string; email: string; firstName: string | null }): Promise<string> {
  const [org] = await db.insert(organizations).values({
    name: `${user.firstName ?? 'Agent'}'s Workspace`,
    slug: `${slugify(`${user.firstName || 'agent'}-${user.email.split('@')[0]}`)}-${Date.now()}`,
    plan: 'free', maxAgents: 1,
  }).returning({ id: organizations.id })
  await db.insert(subscriptions).values({ orgId: org.id, userId: user.id, plan: 'free', status: 'active' })
  await db.update(users).set({ orgId: org.id, role: 'owner', updatedAt: new Date() }).where(eq(users.id, user.id))
  await db.update(brandKits).set({ orgId: org.id }).where(eq(brandKits.userId, user.id))
  return org.id
}

export async function removeTeamMember(actor: { id: string; orgId: string | null; role: string }, targetId: string):
  Promise<{ ok: true } | Fail> {
  if (!actor.orgId || !['owner', 'admin'].includes(actor.role)) return fail(403, 'role', 'Only owners and admins can remove members.')
  if (targetId === actor.id) return fail(400, 'self', 'You cannot remove yourself.')
  const target = await db.query.users.findFirst({ where: and(eq(users.id, targetId), eq(users.orgId, actor.orgId)), columns: { id: true, email: true, firstName: true, role: true } })
  if (!target) return fail(404, 'not_found', 'Member not found.')
  if (target.role === 'owner') return fail(403, 'owner', 'The account owner cannot be removed.')
  if (target.role === 'admin' && actor.role !== 'owner') return fail(403, 'role', 'Only the owner can remove an admin.')
  await detachToOwnWorkspace(target)
  return { ok: true }
}

// ── Billing-event enforcement ──────────────────────────────────

/**
 * Called by the Stripe webhook after every plan change. If the organization now has more people than its plan allows,
 * the newest members are detached to their own free workspaces and surplus pending invites are revoked.
 */
export async function enforceSeatLimits(orgId: string): Promise<{ detached: number; revoked: number }> {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId), columns: { plan: true } })
  if (!org) return { detached: 0, revoked: 0 }
  const limit = seatLimitFor(org.plan)
  await db.update(organizations).set({ maxAgents: limit }).where(eq(organizations.id, orgId))

  const members = await db.select({ id: users.id, email: users.email, firstName: users.firstName, role: users.role, createdAt: users.createdAt })
    .from(users).where(and(eq(users.orgId, orgId), isNull(users.deletedAt))).orderBy(asc(users.createdAt))
  const extra = membersToDetach(members, limit)
  for (const m of extra) await detachToOwnWorkspace(m)

  // Pending invites may only fill seats that are actually free.
  const free = Math.max(0, limit - (members.length - extra.length))
  const pending = await db.select({ id: teamInvites.id }).from(teamInvites)
    .where(and(eq(teamInvites.orgId, orgId), eq(teamInvites.status, 'pending'))).orderBy(asc(teamInvites.createdAt))
  const surplus = pending.slice(free).map(p => p.id)
  if (surplus.length) await db.update(teamInvites).set({ status: 'revoked' }).where(inArray(teamInvites.id, surplus))
  return { detached: extra.length, revoked: surplus.length }
}

// ── Referral conversion ────────────────────────────────────────

/**
 * Mark LINK referrals as upgraded when the referred person's own organization now has an active paid subscription.
 * Team-invite rows never become "upgraded": invitees inherit a plan, they did not buy one.
 */
export async function markReferralsUpgraded(orgId: string): Promise<number> {
  const owners = await db.select({ id: users.id }).from(users).where(and(eq(users.orgId, orgId), eq(users.role, 'owner')))
  if (!owners.length) return 0
  const rows = await db.update(referrals).set({ status: 'upgraded' })
    .where(and(inArray(referrals.referredUserId, owners.map(o => o.id)), eq(referrals.source, 'link'), ne(referrals.status, 'upgraded')))
    .returning({ id: referrals.id })
  return rows.length
}
