/**
 * CampaignAI — Stripe Client + Billing Helpers
 *
 * FIX: All plan definitions and feature gates have been moved to lib/plans.ts.
 * This file now contains only the Stripe client, webhook event types,
 * and billing helpers. canAccessFeature() is re-exported from plans.ts
 * for backwards compatibility.
 */

import Stripe from 'stripe'
import {
  canAccess,
  PLANS,
  PLAN_MAP,
  CAMPAIGN_LIMITS,
  FEATURE_GATES,
} from './plans'

// Re-export everything so existing imports continue to work
export type { PlanTier, BillingInterval, Plan, PlanFeature, Feature } from './plans'
export { canAccess, PLANS, PLAN_MAP, CAMPAIGN_LIMITS, FEATURE_GATES }

// canAccessFeature is an alias for canAccess — both names are supported
export const canAccessFeature = canAccess

// ── Stripe Client ──────────────────────────────────────────────
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('[stripe] STRIPE_SECRET_KEY is not set. Check your environment variables.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
})

// ── Plan lookup by tier ────────────────────────────────────────
export function getPlan(tier: import('./plans').PlanTier) {
  return PLANS.find((p) => p.id === tier)
}

// ── Stripe webhook event types ─────────────────────────────────
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

// ── Enterprise plan (contact sales — no Stripe price ID) ───────
export const ENTERPRISE_PLAN = {
  id: 'enterprise' as import('./plans').PlanTier,
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
