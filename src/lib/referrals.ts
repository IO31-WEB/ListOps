/**
 * Referral claiming (shared link / code). One implementation used by POST /api/referral/redeem and the /join landing page
 * the sign-up flow redirects through, so the ?ref= code in a shared link is actually recorded.
 *
 *  - Race-safe: the users.referred_by slot is claimed with a single conditional UPDATE.
 *  - Abuse limits: no self-referral, no referring someone in your own organization, claim window after sign-up,
 *    soft-deleted referrers don't count.
 *  - 'upgraded' is set by the Stripe webhook (markReferralsUpgraded) only when the referred person's own org pays.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { referrals, users } from '@/lib/db/schema'

export const REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,32}$/
export const REFERRAL_CLAIM_WINDOW_DAYS = 14

export type ClaimResult = { ok: true; referrerId: string; referrerClerkId: string } | { ok: false; status: number; error: string }

export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const c = raw.trim().toUpperCase()
  return REFERRAL_CODE_RE.test(c) ? c : null
}

export async function claimReferral(newUser: { id: string; orgId: string | null; email: string; referredBy: string | null; createdAt: Date }, code: string): Promise<ClaimResult> {
  if (newUser.referredBy) return { ok: false, status: 400, error: 'Referral code already applied' }
  if (Date.now() - newUser.createdAt.getTime() > REFERRAL_CLAIM_WINDOW_DAYS * 86_400_000) {
    return { ok: false, status: 400, error: 'Referral codes can only be applied to new accounts.' }
  }
  const referrer = await db.query.users.findFirst({ where: and(eq(users.referralCode, code), isNull(users.deletedAt)) })
  if (!referrer) return { ok: false, status: 404, error: 'Invalid referral code' }
  if (referrer.id === newUser.id) return { ok: false, status: 400, error: 'Cannot refer yourself' }
  if (referrer.orgId && referrer.orgId === newUser.orgId) return { ok: false, status: 400, error: 'Cannot refer a member of your own team' }

  const claimed = await db.update(users).set({ referredBy: referrer.id })
    .where(and(eq(users.id, newUser.id), isNull(users.referredBy)))
    .returning({ id: users.id })
  if (claimed.length === 0) return { ok: false, status: 400, error: 'Referral code already applied' }

  // One row per (referrer, referred user): upgrade an earlier pending row for this email if there is one.
  const prior = await db.query.referrals.findFirst({
    where: and(eq(referrals.referrerId, referrer.id), eq(referrals.referredEmail, newUser.email), eq(referrals.source, 'link')),
    columns: { id: true },
  })
  if (prior) await db.update(referrals).set({ referredUserId: newUser.id, status: 'signed_up' }).where(eq(referrals.id, prior.id))
  else await db.insert(referrals).values({ referrerId: referrer.id, referredUserId: newUser.id, referredEmail: newUser.email, status: 'signed_up', rewardGranted: false, source: 'link' })

  return { ok: true, referrerId: referrer.id, referrerClerkId: referrer.clerkId }
}
