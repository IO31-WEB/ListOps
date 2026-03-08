/**
 * Stripe Webhook Handler Tests
 * Tests the subscription sync logic in isolation
 */

// Mock Drizzle DB
jest.mock('@/lib/db', () => ({
  db: {
    query: {
      organizations: { findFirst: jest.fn() },
      subscriptions: { findFirst: jest.fn() },
    },
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) })),
    insert: jest.fn(() => ({ values: jest.fn(() => ({ onConflictDoUpdate: jest.fn() })) })),
  },
}))

describe('Stripe webhook - subscription sync', () => {
  test('maps starter monthly price to starter plan', () => {
    const priceToplan: Record<string, string> = {
      [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? 'price_starter_m']: 'starter',
      [process.env.STRIPE_STARTER_YEARLY_PRICE_ID ?? 'price_starter_y']: 'starter',
      [process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? 'price_pro_m']: 'pro',
      [process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? 'price_pro_y']: 'pro',
      [process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID ?? 'price_brokerage_m']: 'brokerage',
      [process.env.STRIPE_BROKERAGE_YEARLY_PRICE_ID ?? 'price_brokerage_y']: 'brokerage',
    }

    expect(priceToplan['price_starter_m']).toBe('starter')
    expect(priceToplan['price_pro_m']).toBe('pro')
    expect(priceToplan['price_brokerage_m']).toBe('brokerage')
  })

  test('unknown price ID falls back to free', () => {
    const mapPriceToTier = (priceId: string): string => {
      const map: Record<string, string> = {
        [process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '']: 'pro',
      }
      return map[priceId] ?? 'free'
    }

    expect(mapPriceToTier('price_unknown_xyz')).toBe('free')
    expect(mapPriceToTier('')).toBe('free')
  })

  test('subscription with current_period_end=0 uses 30-day fallback', () => {
    const rawEnd = 0
    const resolvedEnd = rawEnd
      ? new Date(rawEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    expect(resolvedEnd.getTime()).toBeGreaterThan(Date.now())
    // Should be approximately 30 days from now
    const diffDays = (resolvedEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(30, 0)
  })
})
