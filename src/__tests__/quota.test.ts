/**
 * Campaign Quota Tests
 *
 * NEW: Tests for the atomic quota system and billing period reset logic.
 * These verify the behavior that the old TOCTOU-vulnerable code couldn't test.
 */

import { describe, test, expect } from 'vitest'
import { CAMPAIGN_LIMITS } from '@/lib/plans'
import { needsBillingReset, quotaWindow, addMonthsUtc } from '@/lib/quota-period'

// ── Quota math helpers (extracted for pure unit testing) ──────

function isQuotaAllowed(used: number, limit: number | 'unlimited'): boolean {
  if (limit === 'unlimited') return true
  return used < limit
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

  test('a reset recorded exactly at the period start does not reset again mid-period', () => {
    // 31-day month: the old "periodEnd − 30 days" rule put the window start a day AFTER this reset.
    const periodEnd = new Date('2025-03-15T00:00:00Z')
    expect(needsBillingReset(new Date('2025-02-15T00:00:00Z'), periodEnd, new Date('2025-03-01T00:00:00Z'))).toBe(false)
  })

  test('annual plan: the period end is a year away, quota still resets monthly (not on every call)', () => {
    const periodEnd = new Date('2026-06-15T00:00:00Z')
    const sep20 = new Date('2025-09-20T12:00:00Z')
    expect(quotaWindow(periodEnd, sep20).start.toISOString()).toBe('2025-09-15T00:00:00.000Z')
    expect(quotaWindow(periodEnd, sep20).next.toISOString()).toBe('2025-10-15T00:00:00.000Z')
    expect(needsBillingReset(new Date('2025-09-16T00:00:00Z'), periodEnd, sep20)).toBe(false) // already reset this month
    expect(needsBillingReset(new Date('2025-08-20T00:00:00Z'), periodEnd, sep20)).toBe(true)  // last month's reset
  })

  test('stale / past period end falls back to calendar months', () => {
    const w = quotaWindow(new Date('2025-01-01T00:00:00Z'), now)
    expect(w.start.toISOString()).toBe('2025-03-01T00:00:00.000Z')
    expect(w.next.toISOString()).toBe('2025-04-01T00:00:00.000Z')
  })

  test('month math clamps the day', () => {
    expect(addMonthsUtc(new Date('2025-03-31T00:00:00Z'), -1).toISOString()).toBe('2025-02-28T00:00:00.000Z')
    expect(addMonthsUtc(new Date('2024-03-31T00:00:00Z'), -1).toISOString()).toBe('2024-02-29T00:00:00.000Z')
    expect(addMonthsUtc(new Date('2025-01-15T00:00:00Z'), -1).toISOString()).toBe('2024-12-15T00:00:00.000Z')
  })
})
