/**
 * Plan & Feature Gate Tests
 * Run: npx vitest (after npm install vitest)
 * Or:  npx jest (after npm install --save-dev jest @types/jest ts-jest)
 */
import { canAccess, CAMPAIGN_LIMITS, PLANS, PLAN_MAP } from '@/lib/plans'

describe('Plan feature gates', () => {
  test('free plan cannot access brand_kit', () => {
    expect(canAccess('free', 'brand_kit')).toBe(false)
  })

  test('starter plan can access brand_kit', () => {
    expect(canAccess('starter', 'brand_kit')).toBe(true)
  })

  test('starter plan cannot access video_script', () => {
    expect(canAccess('starter', 'video_script')).toBe(false)
  })

  test('pro plan can access video_script', () => {
    expect(canAccess('pro', 'video_script')).toBe(true)
  })

  test('pro plan cannot access white_label', () => {
    expect(canAccess('pro', 'white_label')).toBe(false)
  })

  test('brokerage plan can access white_label', () => {
    expect(canAccess('brokerage', 'white_label')).toBe(true)
  })

  test('starter and above can remove branding', () => {
    expect(canAccess('free', 'remove_branding')).toBe(false)
    expect(canAccess('starter', 'remove_branding')).toBe(true)
    expect(canAccess('pro', 'remove_branding')).toBe(true)
  })
})

describe('Campaign limits', () => {
  test('free plan is limited to 3 campaigns', () => {
    expect(CAMPAIGN_LIMITS.free).toBe(3)
  })

  test('starter plan is limited to 5 campaigns', () => {
    expect(CAMPAIGN_LIMITS.starter).toBe(5)
  })

  test('pro plan is unlimited', () => {
    expect(CAMPAIGN_LIMITS.pro).toBe('unlimited')
  })

  test('brokerage plan is unlimited', () => {
    expect(CAMPAIGN_LIMITS.brokerage).toBe('unlimited')
  })
})

describe('Plan data integrity', () => {
  test('all plans have required fields', () => {
    PLANS.forEach(plan => {
      expect(plan.id).toBeTruthy()
      expect(plan.name).toBeTruthy()
      expect(plan.features.length).toBeGreaterThan(0)
    })
  })

  test('paid plans have Stripe price ID env vars defined', () => {
    const paidPlans = PLANS.filter(p => p.monthlyPrice && p.monthlyPrice > 0)
    paidPlans.forEach(plan => {
      // These will be undefined in CI without env vars — that's expected
      // This test just confirms the fields exist on the plan object
      expect('monthlyPriceId' in plan).toBe(true)
      expect('yearlyPriceId' in plan).toBe(true)
    })
  })

  test('pro plan is highlighted', () => {
    expect(PLAN_MAP.pro.highlighted).toBe(true)
  })

  test('no two plans are highlighted', () => {
    const highlighted = PLANS.filter(p => p.highlighted)
    expect(highlighted.length).toBe(1)
  })
})
