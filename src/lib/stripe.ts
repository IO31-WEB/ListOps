/**
 * CampaignAI — Stripe Billing Configuration
 * All plan definitions, features, and Stripe helpers
 */

import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

// ── Plan Definitions ──────────────────────────────────────────

export type PlanTier = 'free' | 'starter' | 'pro' | 'brokerage' | 'enterprise'
export type BillingInterval = 'month' | 'year'

export interface PlanFeature {
  text: string
  included: boolean
  highlight?: boolean
}

export interface Plan {
  id: PlanTier
  name: string
  tagline: string
  monthlyPrice: number
  yearlyPrice: number
  yearlyDiscount: number
  monthlyPriceId: string
  yearlyPriceId: string
  campaignsPerMonth: number | 'unlimited'
  maxAgents: number
  features: PlanFeature[]
  cta: string
  highlighted: boolean
  badge?: string
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Try before you commit',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscount: 0,
    monthlyPriceId: '',
    yearlyPriceId: '',
    campaignsPerMonth: 3,
    maxAgents: 1,
    cta: 'Start Free',
    highlighted: false,
    features: [
      { text: '3 campaigns / month', included: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Copy to clipboard', included: true },
      { text: 'Basic flyer template (1)', included: true },
      { text: 'CampaignAI branding on outputs', included: true },
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
    yearlyDiscount: 28,
    monthlyPriceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '',
    yearlyPriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || '',
    campaignsPerMonth: 5,
    maxAgents: 1,
    cta: 'Start Starter',
    highlighted: false,
    features: [
      { text: '5 campaigns / month', included: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Brand kit (logo, colors, photo)', included: true, highlight: true },
      { text: 'Campaign history (30 days)', included: true },
      { text: '3 flyer templates', included: true },
      { text: 'Remove CampaignAI branding', included: true },
      { text: 'Direct social scheduling', included: false },
      { text: 'Listing microsite', included: false },
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
    yearlyDiscount: 26,
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
    yearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
    campaignsPerMonth: 'unlimited',
    maxAgents: 3,
    cta: 'Go Pro',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited campaigns', included: true, highlight: true },
      { text: 'All 6 content types (FB, IG, Email, Flyer)', included: true },
      { text: 'Full brand kit (logo, colors, photo)', included: true },
      { text: 'Campaign history (unlimited)', included: true },
      { text: '3 flyer templates (Classic, Luxury, Modern)', included: true },
      { text: 'Remove CampaignAI branding', included: true },
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
    yearlyDiscount: 30,
    monthlyPriceId: process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID || '',
    yearlyPriceId: process.env.STRIPE_BROKERAGE_YEARLY_PRICE_ID || '',
    campaignsPerMonth: 'unlimited',
    maxAgents: 25,
    cta: 'Start Brokerage Trial',
    highlighted: false,
    badge: 'Best Value',
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

// ── Helper: get plan by tier ──────────────────────────────────

export function getPlan(tier: PlanTier): Plan | undefined {
  return PLANS.find((p) => p.id === tier)
}

export function canAccessFeature(tier: PlanTier, feature: string): boolean {
  // Single source of truth lives in lib/plans.ts FEATURE_GATES
  const FEATURE_GATES: Record<string, PlanTier[]> = {
    brand_kit:           ['starter', 'pro', 'brokerage', 'enterprise'],
    campaign_history:    ['starter', 'pro', 'brokerage', 'enterprise'],
    remove_branding:     ['starter', 'pro', 'brokerage', 'enterprise'],
    unlimited_campaigns: ['pro', 'brokerage', 'enterprise'],
    social_scheduling:   ['pro', 'brokerage', 'enterprise'],
    microsite:           ['pro', 'brokerage', 'enterprise'],
    listing_microsite:   ['pro', 'brokerage', 'enterprise'],
    video_script:        ['pro', 'brokerage', 'enterprise'],
    team_seats:          ['pro', 'brokerage', 'enterprise'],
    priority_generation: ['pro', 'brokerage', 'enterprise'],
    white_label:         ['brokerage', 'enterprise'],
    analytics:           ['brokerage', 'enterprise'],
    analytics_dashboard: ['brokerage', 'enterprise'],
    admin_dashboard:     ['brokerage', 'enterprise'],
    audit_logs:          ['brokerage', 'enterprise'],
    multi_agent:         ['brokerage', 'enterprise'],
    sso:                 ['enterprise'],
    api_access:          ['enterprise'],
  }
  return FEATURE_GATES[feature]?.includes(tier) ?? false
}

// ── Stripe webhook event types we handle ─────────────────────

export const STRIPE_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.trial_will_end',
] as const

export type StripeEvent = typeof STRIPE_EVENTS[number]
