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
  test('free plan is limited to 3', () => { expect(CAMPAIGN_LIMITS.free).toBe(3) })
  test('starter plan is limited to 5', () => { expect(CAMPAIGN_LIMITS.starter).toBe(5) })
  test('pro plan is unlimited', () => { expect(CAMPAIGN_LIMITS.pro).toBe('unlimited') })
  test('brokerage plan is unlimited', () => { expect(CAMPAIGN_LIMITS.brokerage).toBe('unlimited') })
})

describe('Plan data integrity', () => {
  test('all plans have required fields', () => {
    PLANS.forEach(plan => {
      expect(plan.id).toBeTruthy()
      expect(plan.name).toBeTruthy()
      expect(plan.features.length).toBeGreaterThan(0)
    })
  })
  test('pro plan is highlighted', () => { expect(PLAN_MAP.pro.highlighted).toBe(true) })
  test('only one plan is highlighted', () => {
    expect(PLANS.filter(p => p.highlighted).length).toBe(1)
  })
})
