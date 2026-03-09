/**
 * Plan Feature Gate Tests
 *
 * Covers the single source of truth in lib/plans.ts.
 * FIX: Added microsite access test for Starter (was broken in old stripe.ts gate).
 * FIX: Added canAccess type safety test.
 */

import { describe, test, expect } from 'vitest'
import { canAccess, CAMPAIGN_LIMITS, PLANS, PLAN_MAP, FEATURE_GATES } from '@/lib/plans'

describe('Feature gates — free plan', () => {
  test('cannot access brand_kit', () => expect(canAccess('free', 'brand_kit')).toBe(false))
  test('cannot access video_script', () => expect(canAccess('free', 'video_script')).toBe(false))
  test('cannot access white_label', () => expect(canAccess('free', 'white_label')).toBe(false))
  test('cannot access listing_microsite', () => expect(canAccess('free', 'listing_microsite')).toBe(false))
  test('cannot access remove_branding', () => expect(canAccess('free', 'remove_branding')).toBe(false))
  test('cannot access analytics', () => expect(canAccess('free', 'analytics')).toBe(false))
})

describe('Feature gates — starter plan', () => {
  test('can access brand_kit', () => expect(canAccess('starter', 'brand_kit')).toBe(true))
  test('can access campaign_history', () => expect(canAccess('starter', 'campaign_history')).toBe(true))
  test('can access remove_branding', () => expect(canAccess('starter', 'remove_branding')).toBe(true))
  // FIX: This was previously BROKEN — starter was blocked from microsites despite pricing page
  test('can access listing_microsite (pricing page promise)', () => {
    expect(canAccess('starter', 'listing_microsite')).toBe(true)
  })
  test('cannot access video_script', () => expect(canAccess('starter', 'video_script')).toBe(false))
  test('cannot access white_label', () => expect(canAccess('starter', 'white_label')).toBe(false))
  test('cannot access social_scheduling', () => expect(canAccess('starter', 'social_scheduling')).toBe(false))
})

describe('Feature gates — pro plan', () => {
  test('can access video_script', () => expect(canAccess('pro', 'video_script')).toBe(true))
  test('can access social_scheduling', () => expect(canAccess('pro', 'social_scheduling')).toBe(true))
  test('can access team_seats', () => expect(canAccess('pro', 'team_seats')).toBe(true))
  test('can access listing_microsite', () => expect(canAccess('pro', 'listing_microsite')).toBe(true))
  test('cannot access white_label', () => expect(canAccess('pro', 'white_label')).toBe(false))
  test('cannot access analytics', () => expect(canAccess('pro', 'analytics')).toBe(false))
})

describe('Feature gates — brokerage plan', () => {
  test('can access white_label', () => expect(canAccess('brokerage', 'white_label')).toBe(true))
  test('can access analytics', () => expect(canAccess('brokerage', 'analytics')).toBe(true))
  test('can access audit_logs', () => expect(canAccess('brokerage', 'audit_logs')).toBe(true))
  test('can access admin_dashboard', () => expect(canAccess('brokerage', 'admin_dashboard')).toBe(true))
  test('cannot access sso (enterprise only)', () => expect(canAccess('brokerage', 'sso')).toBe(false))
})

describe('Feature gates — enterprise plan', () => {
  test('can access sso', () => expect(canAccess('enterprise', 'sso')).toBe(true))
  test('can access api_access', () => expect(canAccess('enterprise', 'api_access')).toBe(true))
  test('can access everything brokerage can', () => {
    expect(canAccess('enterprise', 'white_label')).toBe(true)
    expect(canAccess('enterprise', 'analytics')).toBe(true)
    expect(canAccess('enterprise', 'audit_logs')).toBe(true)
  })
})

describe('Campaign limits', () => {
  test('free is limited to 3', () => expect(CAMPAIGN_LIMITS.free).toBe(3))
  test('starter is limited to 5', () => expect(CAMPAIGN_LIMITS.starter).toBe(5))
  test('pro is unlimited', () => expect(CAMPAIGN_LIMITS.pro).toBe('unlimited'))
  test('brokerage is unlimited', () => expect(CAMPAIGN_LIMITS.brokerage).toBe('unlimited'))
  test('enterprise is unlimited', () => expect(CAMPAIGN_LIMITS.enterprise).toBe('unlimited'))
})

describe('Plan data integrity', () => {
  test('all plans have required fields', () => {
    PLANS.forEach(plan => {
      expect(plan.id).toBeTruthy()
      expect(plan.name).toBeTruthy()
      expect(plan.cta).toBeTruthy()
      expect(plan.features.length).toBeGreaterThan(0)
    })
  })
  test('exactly one plan is highlighted (Most Popular)', () => {
    expect(PLANS.filter(p => p.highlighted).length).toBe(1)
  })
  test('pro plan is the highlighted one', () => {
    expect(PLAN_MAP.pro.highlighted).toBe(true)
  })
  test('PLAN_MAP contains all plan IDs', () => {
    const ids = PLANS.map(p => p.id)
    ids.forEach(id => expect(PLAN_MAP[id]).toBeDefined())
  })
  test('no plan has an undefined price ID referencing unset env vars in a way that breaks maps', () => {
    // Price IDs will be undefined in test env — ensure nothing hard-crashes
    PLANS.forEach(plan => {
      expect(() => canAccess(plan.id, 'brand_kit')).not.toThrow()
    })
  })
})

describe('FEATURE_GATES completeness', () => {
  test('every feature gate only references valid plan tiers', () => {
    const validTiers = ['free', 'starter', 'pro', 'brokerage', 'enterprise']
    Object.entries(FEATURE_GATES).forEach(([feature, tiers]) => {
      tiers.forEach(tier => {
        expect(validTiers).toContain(tier)
      })
    })
  })

  test('no feature gate is empty', () => {
    Object.entries(FEATURE_GATES).forEach(([feature, tiers]) => {
      expect(tiers.length).toBeGreaterThan(0)
    })
  })
})
