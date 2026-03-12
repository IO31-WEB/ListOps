/**
 * ListOps — Single Source of Truth for Plan Definitions & Feature Gates
 *
 * FIX: Previously split across stripe.ts and plans.ts, causing divergence bugs.
 * This is now the ONLY place plan data and feature gates are defined.
 * stripe.ts imports from here. types/index.ts re-exports PlanTier from here.
 */

// ── Plan Tier Type ─────────────────────────────────────────────
export type PlanTier = 'free' | 'starter' | 'pro' | 'commercial' | 'brokerage' | 'enterprise'
export type PlanId = PlanTier

export type BillingInterval = 'month' | 'year'

// ── Feature Gates ──────────────────────────────────────────────
// Single authoritative list. Both the API and UI read from here.
// When adding a new feature, update this object ONLY — nowhere else.
export const FEATURE_GATES = {
  brand_kit:            ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  campaign_history:     ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  remove_branding:      ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  // FIX: starter now correctly gets listing_microsite (was blocked in stripe.ts despite pricing page promise)
  listing_microsite:    ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  unlimited_campaigns:  ['pro', 'commercial', 'brokerage', 'enterprise'],
  social_scheduling:    ['pro', 'commercial', 'brokerage', 'enterprise'],
  video_script:         ['pro', 'commercial', 'brokerage', 'enterprise'],
  team_seats:           ['pro', 'commercial', 'brokerage', 'enterprise'],
  priority_generation:  ['pro', 'commercial', 'brokerage', 'enterprise'],
  white_label:          ['brokerage', 'enterprise'],
  analytics:            ['brokerage', 'enterprise'],
  analytics_dashboard:  ['brokerage', 'enterprise'],
  admin_dashboard:      ['brokerage', 'enterprise'],
  audit_logs:           ['brokerage', 'enterprise'],
  multi_agent:          ['pro', 'commercial', 'brokerage', 'enterprise'],
  sso:                  ['enterprise'],
  api_access:           ['enterprise'],
  // Content module gates
  listing_copy:         ['free', 'starter', 'pro', 'brokerage', 'enterprise'],  // all plans
  print_materials:      ['free', 'starter', 'pro', 'brokerage', 'enterprise'],  // all plans
  photo_captions:       ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  email_drip:           ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  microsite_copy:       ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  expanded_social:      ['pro', 'commercial', 'brokerage', 'enterprise'],   // TikTok, LinkedIn, X, Stories
  virtual_tour_scripts: ['pro', 'commercial', 'brokerage', 'enterprise'],
  // Commercial plan gates
  costar_integration:   ['commercial', 'brokerage', 'enterprise'],
  property_grading:     ['commercial', 'brokerage', 'enterprise'],
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
  commercial: 'unlimited',
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
      { text: 'MLS listing data auto-pull (500+ boards)', included: true },
      { text: '10 headline variations + full MLS description', included: true },
      { text: '6-week Facebook & Instagram calendar', included: true },
      { text: 'Just Listed + Still Available emails', included: true },
      { text: 'Print materials (yard sign, postcard, brochure)', included: true },
      { text: 'Print-ready listing flyer (PDF)', included: true },
      { text: 'Copy to clipboard', included: true },
      { text: 'Brand kit', included: false },
      { text: 'Email drip sequences (8 templates)', included: false },
      { text: 'AI photo captions (per room)', included: false },
      { text: 'Listing microsite', included: false },
      { text: 'Video & reel scripts', included: false },
      { text: 'TikTok, LinkedIn, X, Stories content', included: false },
      { text: 'White-label outputs', included: false },
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
      { text: 'Everything in Free', included: true },
      { text: 'Brand kit (logo, colors, headshot, tone)', included: true, highlight: true },
      { text: 'Remove ListOps branding', included: true },
      { text: 'Email drip sequences (8 templates)', included: true, highlight: true },
      { text: 'AI photo captions per MLS photo', included: true },
      { text: 'Auto-generated listing microsite', included: true },
      { text: 'Microsite copy editor', included: true },
      { text: 'Campaign history (30 days)', included: true },
      { text: '3 flyer templates (Classic, Luxury, Modern)', included: true },
      { text: 'Video & reel scripts', included: false },
      { text: 'TikTok, LinkedIn, X, Stories content', included: false },
      { text: 'Virtual tour narration scripts', included: false },
      { text: 'White-label outputs', included: false },
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
      { text: 'Everything in Starter', included: true },
      { text: '6-week video & reel scripts', included: true, highlight: true },
      { text: 'Virtual tour narration (4 script types)', included: true },
      { text: 'TikTok, LinkedIn, X & Stories content', included: true, highlight: true },
      { text: '6-week hashtag strategy packs', included: true },
      { text: '3 team seats', included: true },
      { text: 'Priority generation (<30s)', included: true },
      { text: 'Campaign history (unlimited)', included: true },
      { text: '3 flyer templates + 5 color schemes', included: true },
      { text: 'White-label outputs', included: false },
      { text: 'Agent performance analytics', included: false },
      { text: 'Admin dashboard', included: false },
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
      { text: 'Brokerage brand override on all content', included: true },
      { text: 'Agent performance analytics', included: true },
      { text: 'Admin dashboard', included: true },
      { text: 'Compliance & audit logs', included: true },
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

// ── Commercial Plan Definition ─────────────────────────────────
// Appended separately to avoid patching the PLANS array inline.
// The pricing page and billing page both iterate PLANS, so we insert
// commercial between pro and brokerage at array position 3.

;(function injectCommercialPlan() {
  const proIndex = PLANS.findIndex(p => p.id === 'pro')
  if (proIndex === -1 || PLANS.find(p => p.id === 'commercial')) return
  PLANS.splice(proIndex + 1, 0, {
    id: 'commercial',
    name: 'Commercial',
    tagline: 'For commercial real estate professionals',
    monthlyPrice: 179,
    yearlyPrice: 1590,
    monthlyPriceId: process.env.STRIPE_COMMERCIAL_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_COMMERCIAL_YEARLY_PRICE_ID,
    highlighted: false,
    badge: 'Commercial RE',
    cta: 'Go Commercial',
    campaignsPerMonth: 'unlimited',
    maxAgents: 3,
    features: [
      { text: 'Everything in Pro', included: true, highlight: true },
      { text: 'CoStar report upload & parsing', included: true, highlight: true },
      { text: 'AI property grading card (A–F)', included: true, highlight: true },
      { text: 'Traffic count scoring', included: true },
      { text: 'Consumer spend analysis (1/3/5 mi)', included: true },
      { text: 'Household income grading', included: true },
      { text: 'Big-box & anchor tenant detection', included: true },
      { text: 'CoStar API push integration', included: true },
      { text: 'Demographic scoring', included: true },
      { text: 'AI site narrative & risk flags', included: true },
      { text: 'PDF grade card export', included: true },
      { text: 'White-label outputs', included: false },
    ],
  })
})()
