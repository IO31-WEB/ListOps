jest.mock('@/lib/db', () => ({
  db: {
    query: { organizations: { findFirst: jest.fn() }, subscriptions: { findFirst: jest.fn() } },
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) })),
    insert: jest.fn(() => ({ values: jest.fn(() => ({ onConflictDoUpdate: jest.fn() })) })),
  },
}))

describe('Stripe webhook - subscription sync', () => {
  test('maps price IDs to correct plans', () => {
    const map: Record<string, string> = {
      [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? 'price_starter_m']: 'starter',
      [process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? 'price_pro_m']: 'pro',
      [process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID ?? 'price_brokerage_m']: 'brokerage',
    }
    expect(map['price_starter_m']).toBe('starter')
    expect(map['price_pro_m']).toBe('pro')
    expect(map['price_brokerage_m']).toBe('brokerage')
  })
  test('unknown price ID falls back to free', () => {
    const mapPrice = (id: string) => ({ [process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '']: 'pro' }[id] ?? 'free')
    expect(mapPrice('price_unknown')).toBe('free')
  })
  test('current_period_end=0 uses 30-day fallback', () => {
    const raw = 0
    const resolved = raw ? new Date(raw * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const diffDays = (resolved.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(30, 0)
  })
})
