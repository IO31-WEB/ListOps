/**
 * Effective plan resolution — the ONE place that turns "what the org's subscription row says" into
 * "what this person may use right now". Pure (no DB), so it is unit-tested.
 *
 * Rules
 *  - The organization's subscription is the only source of a paid plan. Team members never carry their own plan; they
 *    inherit the org's.
 *  - Inheritance is conditional. A NON-owner member only gets paid access while the org's subscription is `active` or
 *    `trialing`. `past_due`, `canceled`, `paused` (or anything unknown) => free.
 *  - A member also gets nothing paid if the org's plan has no team seats (e.g. owner downgraded to Starter).
 *  - The owner keeps their plan through `past_due` (Stripe is still retrying the card) but not through `canceled`/`paused`.
 */
import { canAccess, seatLimitFor, type PlanTier } from './plans'

export const ENTITLING_STATUSES = ['active', 'trialing'] as const
const OWNER_GRACE_STATUSES = ['active', 'trialing', 'past_due'] as const

export interface PlanSource {
  /** users.role of the person asking. */
  role?: string | null
  organization?: {
    plan?: string | null
    subscriptions?: Array<{ plan?: string | null; status?: string | null }> | null
  } | null
}

const TIERS: readonly string[] = ['free', 'starter', 'pro', 'commercial', 'brokerage', 'enterprise']

export function isEntitlingStatus(status: string | null | undefined): boolean {
  return (ENTITLING_STATUSES as readonly string[]).includes(status ?? '')
}

export function resolvePlan(u: PlanSource | null | undefined): PlanTier {
  const org = u?.organization
  if (!org) return 'free'
  const sub = org.subscriptions?.[0]
  const raw = (sub?.plan ?? org.plan ?? 'free') as string
  const plan = (TIERS.includes(raw) ? raw : 'free') as PlanTier
  if (plan === 'free') return 'free'

  // No subscription row at all but an org plan set (Clerk-metadata / manual override path): treat as active.
  const status = sub?.status ?? 'active'
  const isOwner = u?.role === 'owner'

  if (isOwner) return (OWNER_GRACE_STATUSES as readonly string[]).includes(status) ? plan : 'free'

  // Member (admin / agent / viewer): inherited access, strictly conditional.
  if (!isEntitlingStatus(status)) return 'free'
  if (seatLimitFor(plan) < 2) return 'free'
  return plan
}

/** True when a campaign is commercial but the viewing/owning plan does not include Commercial. One rule, used by every renderer. */
export function isCommercialLocked(campaignType: string | null | undefined, plan: PlanTier): boolean {
  return campaignType === 'commercial' && !canAccess(plan, 'commercial_campaigns')
}
