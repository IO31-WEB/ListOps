/**
 * Single source of truth for plan definitions.
 * Billing page, generate route, and feature gates all read from here.
 * When you add a new plan or feature, change it once here.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'brokerage' | 'enterprise'

export interface PlanFeature {
  text: string
  included: boolean
  highlight?: boolean
}

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number | null   // null = free / contact
  yearlyPrice: number | null
  monthlyPriceId?: string       // Stripe price ID
  yearlyPriceId?: string
  highlighted: boolean          // "Most Popular" badge
  badge?: string                // "Best Value" etc
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
    campaignsPerMonth: 3,
    maxAgents: 1,
    features: [
      { text: '3 campaigns / month', included: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Copy to clipboard', included: true },
      { text: 'Basic flyer template (1)', included: true },
      { text: 'CampaignAI branding on outputs', included: true },
      { text: 'Brand kit upload', included: false },
      { text: 'Campaign history', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For independent agents',
    monthlyPrice: 29,
    yearlyPrice: 249,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY_PRICE_ID,
    highlighted: false,
    campaignsPerMonth: 5,
    maxAgents: 1,
    features: [
      { text: '5 campaigns / month', included: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Brand kit (logo, colors, photo)', included: true, highlight: true },
      { text: 'Campaign history (30 days)', included: true },
      { text: '3 flyer templates', included: true },
      { text: 'Remove CampaignAI branding', included: true },
      { text: 'Direct social scheduling', included: false },
      { text: 'Listing microsite', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For serious producers',
    monthlyPrice: 79,
    yearlyPrice: 699,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
    highlighted: true,
    badge: 'Most Popular',
    campaignsPerMonth: 'unlimited',
    maxAgents: 3,
    features: [
      { text: 'Unlimited campaigns', included: true, highlight: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Full brand kit (logo, colors, photo)', included: true },
      { text: 'Campaign history (unlimited)', included: true },
      { text: '3 flyer templates (Classic, Luxury, Modern)', included: true },
      { text: 'Remove CampaignAI branding', included: true },
      { text: 'Direct social scheduling (Meta, Buffer)', included: true },
      { text: 'Auto-generated listing microsite', included: true },
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
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BROKERAGE_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BROKERAGE_YEARLY_PRICE_ID,
    highlighted: false,
    badge: 'Best Value',
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

/** Campaign limits per plan */
export const CAMPAIGN_LIMITS: Record<PlanId, number | 'unlimited'> = {
  free: 3,
  starter: 5,
  pro: 'unlimited',
  brokerage: 'unlimited',
  enterprise: 'unlimited',
}

/** Feature gate map — which plans unlock which features */
export const FEATURE_GATES: Record<string, PlanId[]> = {
  brand_kit:          ['starter', 'pro', 'brokerage', 'enterprise'],
  campaign_history:   ['starter', 'pro', 'brokerage', 'enterprise'],
  video_script:       ['pro', 'brokerage', 'enterprise'],
  listing_microsite:  ['pro', 'brokerage', 'enterprise'],
  social_scheduling:  ['pro', 'brokerage', 'enterprise'],
  white_label:        ['brokerage', 'enterprise'],
  analytics:          ['brokerage', 'enterprise'],
  unlimited_campaigns:['pro', 'brokerage', 'enterprise'],
  multi_agent:        ['brokerage', 'enterprise'],
  remove_branding:    ['starter', 'pro', 'brokerage', 'enterprise'],
}

export function canAccess(plan: PlanId, feature: string): boolean {
  return FEATURE_GATES[feature]?.includes(plan) ?? false
}
