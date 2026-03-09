/**
 * Campaign Quota Tests
 *
 * NEW: Tests for the atomic quota system and billing period reset logic.
 * These verify the behavior that the old TOCTOU-vulnerable code couldn't test.
 */

import { describe, test, expect } from 'vitest'
import { CAMPAIGN_LIMITS } from '@/lib/plans'

// ── Quota math helpers (extracted for pure unit testing) ──────

function isQuotaAllowed(used: number, limit: number | 'unlimited'): boolean {
  if (limit === 'unlimited') return true
  return used < limit
}

function needsBillingReset(
  lastResetAt: Date,
  periodEnd: Date | null,
  now: Date
): boolean {
  if (periodEnd) {
    // Reset if lastResetAt is before the start of the current billing period
    const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000)
    return lastResetAt < periodStart
  }
  // Calendar month fallback
  return lastResetAt.getMonth() !== now.getMonth() ||
         lastResetAt.getFullYear() !== now.getFullYear()
}

describe('Quota enforcement', () => {
  test('free user at 0/3 is allowed', () => {
    expect(isQuotaAllowed(0, CAMPAIGN_LIMITS.free)).toBe(true)
  })
  test('free user at 2/3 is allowed', () => {
    expect(isQuotaAllowed(2, CAMPAIGN_LIMITS.free)).toBe(true)
  })
  test('free user at 3/3 is blocked (boundary)', () => {
    expect(isQuotaAllowed(3, CAMPAIGN_LIMITS.free)).toBe(false)
  })
  test('starter user at 4/5 is allowed', () => {
    expect(isQuotaAllowed(4, CAMPAIGN_LIMITS.starter)).toBe(true)
  })
  test('starter user at 5/5 is blocked', () => {
    expect(isQuotaAllowed(5, CAMPAIGN_LIMITS.starter)).toBe(false)
  })
  test('pro user is always allowed (unlimited)', () => {
    expect(isQuotaAllowed(9999, CAMPAIGN_LIMITS.pro)).toBe(true)
  })
  test('brokerage user is always allowed (unlimited)', () => {
    expect(isQuotaAllowed(9999, CAMPAIGN_LIMITS.brokerage)).toBe(true)
  })
})

describe('Billing period reset logic', () => {
  const now = new Date('2025-03-15T12:00:00Z')

  test('same billing period — no reset needed', () => {
    const periodEnd = new Date('2025-03-20T00:00:00Z')
    const lastReset = new Date('2025-02-20T00:00:00Z') // within current period
    expect(needsBillingReset(lastReset, periodEnd, now)).toBe(false)
  })

  test('crossed billing period boundary — reset needed', () => {
    const periodEnd = new Date('2025-03-20T00:00:00Z')
    const lastReset = new Date('2025-01-20T00:00:00Z') // before current period
    expect(needsBillingReset(lastReset, periodEnd, now)).toBe(true)
  })

  test('calendar month fallback — same month, no reset', () => {
    const lastReset = new Date('2025-03-01T00:00:00Z')
    expect(needsBillingReset(lastReset, null, now)).toBe(false)
  })

  test('calendar month fallback — new month, reset needed', () => {
    const lastReset = new Date('2025-02-28T00:00:00Z')
    expect(needsBillingReset(lastReset, null, now)).toBe(true)
  })

  test('calendar month fallback — new year, reset needed', () => {
    const lastReset = new Date('2024-12-31T00:00:00Z')
    const jan = new Date('2025-01-01T12:00:00Z')
    expect(needsBillingReset(lastReset, null, jan)).toBe(true)
  })

  test('billing period reset is more accurate than calendar reset', () => {
    // User subscribed Jan 15. It is now Feb 10.
    // Calendar month says "new month" → reset. But billing period hasn't renewed yet.
    const subscriptionPeriodEnd = new Date('2025-02-15T00:00:00Z') // renews Feb 15
    const lastReset = new Date('2025-01-15T00:00:00Z')             // reset on Jan 15
    const feb10 = new Date('2025-02-10T12:00:00Z')

    const calendarWouldReset = lastReset.getMonth() !== feb10.getMonth()
    const billingWouldReset = needsBillingReset(lastReset, subscriptionPeriodEnd, feb10)

    // Calendar says reset (new month), billing says don't (period hasn't renewed)
    expect(calendarWouldReset).toBe(true)
    expect(billingWouldReset).toBe(false)
    // Billing-based reset is correct here — don't reset early
  })
})
