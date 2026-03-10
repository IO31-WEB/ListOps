/**
 * ListOps — Single Source of Truth for Plan Definitions & Feature Gates
 *
 * FIX: Previously split across stripe.ts and plans.ts, causing divergence bugs.
 * This is now the ONLY place plan data and feature gates are defined.
 * stripe.ts imports from here. types/index.ts re-exports PlanTier from here.
 */

// ── Plan Tier Type ─────────────────────────────────────────────
export type PlanTier = 'free' | 'starter' | 'pro' | 'brokerage' | 'enterprise'
export type PlanId = PlanTier

export type BillingInterval = 'month' | 'year'

// ── Feature Gates ──────────────────────────────────────────────
// Single authoritative list. Both the API and UI read from here.
// When adding a new feature, update this object ONLY — nowhere else.
export const FEATURE_GATES = {
  brand_kit:            ['starter', 'pro', 'brokerage', 'enterprise'],
  campaign_history:     ['starter', 'pro', 'brokerage', 'enterprise'],
  remove_branding:      ['starter', 'pro', 'brokerage', 'enterprise'],
  // FIX: starter now correctly gets listing_microsite (was blocked in stripe.ts despite pricing page promise)
  listing_microsite:    ['starter', 'pro', 'brokerage', 'enterprise'],
  unlimited_campaigns:  ['pro', 'brokerage', 'enterprise'],
  social_scheduling:    ['pro', 'brokerage', 'enterprise'],
  video_script:         ['pro', 'brokerage', 'enterprise'],
  team_seats:           ['pro', 'brokerage', 'enterprise'],
  priority_generation:  ['pro', 'brokerage', 'enterprise'],
  white_label:          ['brokerage', 'enterprise'],
  analytics:            ['brokerage', 'enterprise'],
  analytics_dashboard:  ['brokerage', 'enterprise'],
  admin_dashboard:      ['brokerage', 'enterprise'],
  audit_logs:           ['brokerage', 'enterprise'],
  multi_agent:          ['pro', 'brokerage', 'enterprise'],
  sso:                  ['enterprise'],
  api_access:           ['enterprise'],
  // Content module gates
  listing_copy:         ['free', 'starter', 'pro', 'brokerage', 'enterprise'],  // all plans
  print_materials:      ['free', 'starter', 'pro', 'brokerage', 'enterprise'],  // all plans
  photo_captions:       ['starter', 'pro', 'brokerage', 'enterprise'],
  email_drip:           ['starter', 'pro', 'brokerage', 'enterprise'],
  microsite_copy:       ['starter', 'pro', 'brokerage', 'enterprise'],
  expanded_social:      ['pro', 'brokerage', 'enterprise'],   // TikTok, LinkedIn, X, Pinterest, Stories
  virtual_tour_scripts: ['pro', 'brokerage', 'enterprise'],
} as const satisfies Record<string, readonly PlanTier[]>

export type Feature = keyof typeof FEATURE_GATES

/**
 * Check if a plan tier has access to a feature.
 * Use this everywhere — never inline the feature gate logic.
 */
export function canAccess(plan: PlanTier, feature: Feature): boolean {
  return (FEATURE_GATES[feature] as readonly string[]).includes(plan)
}

// ── Campaign Limits ────────────────────────────────────────────
export const CAMPAIGN_LIMITS: Record<PlanTier, number | 'unlimited'> = {
  free: 3,
  starter: 5,
  pro: 'unlimited',
  brokerage: 'unlimited',
  enterprise: 'unlimited',
}

// ── Plan Definitions ───────────────────────────────────────────
export interface PlanFeature {
  text: string
  included: boolean
  highlight?: boolean
}

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number | null
  yearlyPrice: number | null
  monthlyPriceId?: string
  yearlyPriceId?: string
  highlighted: boolean
  badge?: string
  cta: string
  campaignsPerMonth: number | 'unlimited'
  maxAgents: number
  features: PlanFeature[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Try before you commit',
    monthlyPrice: 0,
    yearlyPrice: 0,
    highlighted: false,
    cta: 'Start Free',
    campaignsPerMonth: 3,
    maxAgents: 1,
    features: [
      { text: '3 campaigns / month', included: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Copy to clipboard', included: true },
      { text: 'Basic flyer template (1)', included: true },
      { text: 'ListOps branding on outputs', included: true },
      { text: 'Brand kit upload', included: false },
      { text: 'Campaign history', included: false },
      { text: 'Direct social scheduling', included: false },
      { text: 'Listing microsite', included: false },
      { text: 'Video scripts', included: false },
      { text: 'Team seats', included: false },
      { text: 'White-label outputs', included: false },
      { text: 'Priority generation', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For independent agents',
    monthlyPrice: 29,
    yearlyPrice: 249,
    monthlyPriceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
    highlighted: false,
    cta: 'Start Starter',
    campaignsPerMonth: 5,
    maxAgents: 1,
    features: [
      { text: '5 campaigns / month', included: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Brand kit (logo, colors, photo)', included: true, highlight: true },
      { text: 'Campaign history (30 days)', included: true },
      { text: '3 flyer templates (Classic, Luxury, Modern)', included: true },
      { text: 'Remove ListOps branding', included: true },
      { text: 'Auto-generated listing microsite', included: true },
      { text: 'Direct social scheduling', included: false },
      { text: 'Video scripts', included: false },
      { text: 'Team seats', included: false },
      { text: 'White-label outputs', included: false },
      { text: 'Priority generation', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For serious producers',
    monthlyPrice: 79,
    yearlyPrice: 699,
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    highlighted: true,
    badge: 'Most Popular',
    cta: 'Go Pro',
    campaignsPerMonth: 'unlimited',
    maxAgents: 3,
    features: [
      { text: 'Unlimited campaigns', included: true, highlight: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Full brand kit (logo, colors, photo)', included: true },
      { text: 'Campaign history (unlimited)', included: true },
      { text: '3 flyer templates + 5 color schemes (15 combos)', included: true },
      { text: 'Remove ListOps branding', included: true },
      { text: 'Direct social scheduling (Meta, Buffer)', included: true, highlight: true },
      { text: 'Auto-generated listing microsite', included: true, highlight: true },
      { text: 'Video & reel scripts', included: true },
      { text: '3 team seats', included: true },
      { text: 'Priority generation (<30s)', included: true },
      { text: 'White-label outputs', included: false },
      { text: 'Analytics dashboard', included: false },
    ],
  },
  {
    id: 'brokerage',
    name: 'Brokerage',
    tagline: 'For teams & brokerages',
    monthlyPrice: 299,
    yearlyPrice: 2499,
    monthlyPriceId: process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_BROKERAGE_YEARLY_PRICE_ID,
    highlighted: false,
    badge: 'Best Value',
    cta: 'Start Brokerage Trial',
    campaignsPerMonth: 'unlimited',
    maxAgents: 25,
    features: [
      { text: 'Everything in Pro', included: true, highlight: true },
      { text: 'Up to 25 agent seats', included: true, highlight: true },
      { text: 'White-label all outputs', included: true, highlight: true },
      { text: 'Custom app name & logo', included: true },
      { text: 'Agent performance analytics', included: true },
      { text: 'Brokerage brand override', included: true },
      { text: 'Compliance & audit logs', included: true },
      { text: 'Admin dashboard', included: true },
      { text: 'CSV/PDF export of all campaigns', included: true },
      { text: 'MLS board-wide integration', included: true },
      { text: 'Dedicated Slack support', included: true },
      { text: 'SSO / SAML (add-on)', included: true },
    ],
  },
]

export const PLAN_MAP = Object.fromEntries(PLANS.map(p => [p.id, p])) as Record<PlanId, Plan>

// ENTERPRISE_PLAN is UI-only data (no Stripe price IDs) — safe to import in client components.
// stripe.ts re-exports this for backwards-compat server-side imports.
export const ENTERPRISE_PLAN = {
  id: 'enterprise' as PlanTier,
  name: 'Enterprise',
  tagline: 'MLS board-level deployment',
  price: 'Custom',
  features: [
    'All Brokerage features',
    'Unlimited agents',
    'MLS board-level licensing',
    'Custom domain (marketing.yourbrokerage.com)',
    'SSO/SAML + SCIM provisioning',
    'Dedicated Customer Success Manager',
    'SLA guarantee (99.9% uptime)',
    'Custom AI fine-tuning for your market',
    'Zapier / Make / API marketplace access',
    'Custom integrations & professional services',
    'Annual invoicing (no credit card required)',
  ],
}
