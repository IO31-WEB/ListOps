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
  qr_codes:             ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  social_scheduling:    ['pro', 'commercial', 'brokerage', 'enterprise'],
  video_script:         ['pro', 'commercial', 'brokerage', 'enterprise'],
  team_seats:           ['pro', 'commercial', 'brokerage', 'enterprise'],                    // seat COUNTS live in SEAT_LIMITS below
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
  listing_copy:         ['free', 'starter', 'pro', 'commercial', 'brokerage', 'enterprise'],  // all plans
  print_materials:      ['free', 'starter', 'pro', 'commercial', 'brokerage', 'enterprise'],  // all plans
  photo_captions:       ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  email_drip:           ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  microsite_copy:       ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],
  expanded_social:      ['pro', 'commercial', 'brokerage', 'enterprise'],   // TikTok, LinkedIn, X, Stories
  virtual_tour_scripts: ['pro', 'commercial', 'brokerage', 'enterprise'],
  // Branded Visual Kit + flyers (Round 6)
  visual_kit:           ['free', 'starter', 'pro', 'commercial', 'brokerage', 'enterprise'], // Instagram square (watermarked on Free)
  visual_kit_full:      ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],         // every graphic, no watermark
  visual_kit_pdf:       ['pro', 'commercial', 'brokerage', 'enterprise'],                    // PDF export of graphics
  flyer_templates:      ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],         // Luxury + Modern (Classic is free)
  flyer_variants:       ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],         // Open House / Price Improvement flyers
  flyer_schemes:        ['pro', 'commercial', 'brokerage', 'enterprise'],                    // 5 color schemes
  // Microsite lead capture (Round 7)
  lead_capture:         ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],         // forms on the microsite + leads inbox + email alert
  lead_export:          ['pro', 'commercial', 'brokerage', 'enterprise'],                    // CSV export
  lead_webhook:         ['pro', 'commercial', 'brokerage', 'enterprise'],                    // signed webhook (Zapier "Catch Hook" ready)
  lead_sms:             ['pro', 'commercial', 'brokerage', 'enterprise'],                    // SMS alert to the agent (needs Twilio configured)
  // Compliance (Round 8)
  fair_housing_scan:    ['free', 'starter', 'pro', 'commercial', 'brokerage', 'enterprise'], // protective, so every plan
  compliance_profile:   ['brokerage', 'enterprise'],                                         // org-wide required disclaimer + locked brand fields
  // Performance (Round 9)
  performance_dashboard: ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'],        // per-listing real activity (views, clicks, leads, downloads)
  seller_approval:      ['pro', 'commercial', 'brokerage', 'enterprise'],
  seller_report:        ['pro', 'commercial', 'brokerage', 'enterprise'],                    // shareable branded report link for the seller
  // Commercial (CRE). Hard-gated: Free / Starter / Pro are residential-only. Enforced server-side in /api/generate,
  // /api/listings, regenerate, outreach, the public microsite/flyer/brochure renderers and the dashboard UI.
  commercial_campaigns: ['commercial', 'brokerage', 'enterprise'],                           // the Commercial tab + every CRE campaign type/output
  commercial_om:        ['commercial', 'brokerage', 'enterprise'],                           // section-by-section OM-style copy in the package
  commercial_underwriting: ['commercial', 'brokerage', 'enterprise'],                        // Investment Snapshot + Offering Readiness (pure math, zero API cost)
  outreach_send:        ['commercial', 'brokerage', 'enterprise'],                           // send the email sequence to a prospect list (compliant sender, daily cron follow-ups)
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

// ── Seat Limits (HARD) ─────────────────────────────────────────
// Total people in one organization (the owner counts as a seat). Enforced on invite, on invite acceptance,
// and again whenever a subscription changes (extra members are detached). Single source of truth.
export const SEAT_LIMITS: Record<PlanTier, number> = {
  free: 1,
  starter: 1,
  pro: 2,
  commercial: 2,
  brokerage: 25,
  enterprise: 999, // custom contract: unlimited in practice
}

export function seatLimitFor(plan: PlanTier | string | null | undefined): number {
  return SEAT_LIMITS[(plan ?? 'free') as PlanTier] ?? 1
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
    maxAgents: SEAT_LIMITS.free,
    features: [
      { text: '3 campaigns / month', included: true },
      { text: 'Address auto-fill from public records', included: true },
      { text: '10 headline variations + full MLS-ready description', included: true },
      { text: '6-week Facebook & Instagram calendar', included: true },
      { text: 'Just Listed + Still Available emails', included: true },
      { text: 'Print materials (yard sign, postcard, brochure)', included: true },
      { text: 'Print-ready listing flyer (PDF)', included: true },
      { text: 'Branded Instagram graphic (PNG, ListOps watermark)', included: true },
      { text: 'Copy to clipboard', included: true },
      { text: 'Fair Housing language check with one-click rewrites', included: true },
      { text: 'Brand kit', included: false },
      { text: 'Email templates (8: buyer follow-ups, seller update & more)', included: false },
      { text: 'AI photo captions (per room)', included: false },
      { text: 'Listing microsite', included: false },
      { text: 'Lead capture forms + leads inbox', included: false },
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
    maxAgents: SEAT_LIMITS.starter,
    features: [
      { text: '5 campaigns / month', included: true },
      { text: 'Everything in Free', included: true },
      { text: 'Brand kit (logo, colors, headshot, tone)', included: true, highlight: true },
      { text: 'Email templates (8: buyer follow-ups, seller update & more)', included: true, highlight: true },
      { text: 'AI photo captions from your uploaded photos', included: true },
      { text: 'Auto-generated listing microsite', included: true },
      { text: 'Lead capture on every microsite (Schedule a Showing + Request Info) with instant email alerts', included: true, highlight: true },
      { text: 'Per-listing performance: real views, call/email clicks, inquiries and downloads', included: true },
      { text: 'Trackable QR codes for flyers, signs and brochures (real scan counts)', included: true },
      { text: '3 premium flyer templates + Open House & Price Improvement flyers', included: true },
      { text: 'Full branded visual kit: Instagram square & Stories, Facebook post & cover, open house, price improvement (PNG)', included: true, highlight: true },
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
    maxAgents: SEAT_LIMITS.pro,
    features: [
      { text: 'Unlimited campaigns', included: true, highlight: true },
      { text: 'Everything in Starter', included: true },
      { text: '6-week video & reel scripts', included: true, highlight: true },
      { text: 'Virtual tour narration (4 script types)', included: true },
      { text: 'TikTok, LinkedIn, X & Stories content', included: true, highlight: true },
      { text: 'Hashtag strategy packs (3 sets)', included: true },
      { text: '2 team seats (you + 1 teammate)', included: true },
      { text: '3 flyer templates + 5 color schemes', included: true },
      { text: 'Visual kit PDF export', included: true },
      { text: 'Lead CSV export + Zapier-ready webhook', included: true },
      { text: 'Shareable branded seller report (always current)', included: true, highlight: true },
      { text: 'Seller approval portal: private link, approve or request changes per item, you get emailed', included: true, highlight: true },
      { text: 'Social post calendar: dated queue, daily "due today" email, CSV + calendar export', included: true, highlight: true },
      { text: 'White-label outputs', included: false },
      { text: 'Agent performance analytics', included: false },
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
    maxAgents: SEAT_LIMITS.brokerage,
    features: [
      { text: 'Everything in Commercial (residential + commercial campaigns)', included: true, highlight: true },
      { text: 'Brokerage compliance profile: required disclaimer + locked brand fields for every agent', included: true, highlight: true },
      { text: 'Up to 25 agent seats', included: true, highlight: true },
      { text: 'Your brokerage branding on all outputs', included: true, highlight: true },
      { text: 'Brokerage brand override on all content', included: true },
      { text: 'Agent performance analytics', included: true },
      { text: 'Team activity log', included: true },
      { text: 'CSV export of all team campaigns', included: true },
      { text: 'Board / association-wide deployment', included: true },
      { text: 'Dedicated Slack support', included: true },
    ],
  },
]

// ENTERPRISE_PLAN is UI-only data (no Stripe price IDs) — safe to import in client components.
// stripe.ts re-exports this for backwards-compat server-side imports.
export const ENTERPRISE_PLAN = {
  id: 'enterprise' as PlanTier,
  name: 'Enterprise',
  tagline: 'Board & association deployment',
  price: 'Custom',
  features: [
    'All Brokerage features',
    'Unlimited agents',
    'Board & association licensing',
    'Custom integrations & professional services (scoped per contract)',
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
    maxAgents: SEAT_LIMITS.commercial,
    features: [
      { text: 'Everything in Pro', included: true, highlight: true },
      { text: 'Unlimited commercial campaigns: offering teaser, one-pager and long narrative', included: true, highlight: true },
      { text: 'LinkedIn-first 6-week social + Facebook posts for brokers and investors', included: true, highlight: true },
      { text: '4-touch broker / investor email sequence, written for you', included: true, highlight: true },
      { text: 'Send the sequence to your prospect list (compliant sender, automatic follow-ups)', included: true, highlight: true },
      { text: 'OM-style sectioned copy you can edit and export', included: true },
      { text: 'Investment Snapshot: price/SF, price/unit, implied cap rate and financing scenario math from your own numbers', included: true, highlight: true },
      { text: 'Offering Readiness score: what a buyer or broker will ask for that your listing is still missing', included: true },
      { text: '2 team seats (you + 1 teammate)', included: true },
      { text: 'Commercial teaser microsite with Request Info lead form', included: true },
      { text: 'One-sheet flyer copy, trackable QR codes, seller approval', included: true },
      { text: 'White-label outputs', included: false },
    ],
  })
})()

// Built AFTER the Commercial plan is injected above: building it earlier left PLAN_MAP.commercial undefined at runtime.
export const PLAN_MAP = Object.fromEntries(PLANS.map(p => [p.id, p])) as Record<PlanId, Plan>

// ── Plan comparison (single source of truth for Upgrade / Downgrade labels) ───
// Rank is by monthly price, NOT by a hard-coded tier list: the old list omitted 'commercial', so every
// Commercial card compared as index -1 and was labelled "Downgrade" for everyone. Enterprise (custom pricing,
// not in PLANS) ranks above everything.
export function planRank(id: string): number {
  if (id === 'enterprise') return Number.MAX_SAFE_INTEGER
  const p = PLANS.find(x => x.id === id)
  return p?.monthlyPrice ?? 0
}

export type PlanChange = 'current' | 'upgrade' | 'downgrade'

export function comparePlan(currentId: string, targetId: string): PlanChange {
  if (currentId === targetId) return 'current'
  return planRank(targetId) > planRank(currentId) ? 'upgrade' : 'downgrade'
}

// ── Stripe price id -> plan (shared by the webhook and the billing sync route so they can never disagree) ──
export function planFromPriceId(priceId: string | null | undefined): PlanTier {
  if (!priceId) return 'free'
  const env = process.env
  const map: Array<[string | undefined, PlanTier]> = [
    [env.STRIPE_STARTER_MONTHLY_PRICE_ID, 'starter'], [env.STRIPE_STARTER_YEARLY_PRICE_ID, 'starter'],
    [env.STRIPE_PRO_MONTHLY_PRICE_ID, 'pro'], [env.STRIPE_PRO_YEARLY_PRICE_ID, 'pro'],
    [env.STRIPE_COMMERCIAL_MONTHLY_PRICE_ID, 'commercial'], [env.STRIPE_COMMERCIAL_YEARLY_PRICE_ID, 'commercial'],
    [env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID, 'brokerage'], [env.STRIPE_BROKERAGE_YEARLY_PRICE_ID, 'brokerage'],
  ]
  return map.find(([id]) => !!id && id === priceId)?.[1] ?? 'free'
}
