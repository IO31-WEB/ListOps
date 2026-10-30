/**
 * Monthly campaign-quota windows.
 *
 * A subscription's `stripeCurrentPeriodEnd` is the END of the current billing period. The quota window that
 * contains `now` starts one calendar month (or, on annual plans, a whole number of months) before that end.
 *
 * This replaces `periodEnd - 30 days`, which was wrong in two ways:
 *   • months are 28–31 days, so a reset recorded exactly at the period start looked "too old" and reset AGAIN
 *     mid-period (an extra free quota refill);
 *   • on annual plans the period end is a year away, so `periodEnd - 30d` was always in the future and the counter
 *     reset on every single call (quota never counted).
 * If the stored period end is missing or already past (webhook not yet processed, cancelled), we fall back to
 * calendar months. All math is UTC so results don't depend on the server's timezone.
 */

/** `d` shifted by whole months in UTC, clamping the day (Mar 31 − 1 month → Feb 28/29). */
export function addMonthsUtc(d: Date, months: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + months
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), dim), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()))
}

export interface QuotaWindow { start: Date; next: Date }

export function quotaWindow(periodEnd: Date | null | undefined, now: Date): QuotaWindow {
  if (periodEnd && periodEnd.getTime() > now.getTime()) {
    for (let k = 1; k <= 24; k++) {
      const start = addMonthsUtc(periodEnd, -k)
      if (start.getTime() <= now.getTime()) {
        return { start, next: k === 1 ? periodEnd : addMonthsUtc(periodEnd, -(k - 1)) }
      }
    }
  }
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    next: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

/** True when the last counter reset happened before the current quota window began. */
export function needsBillingReset(lastResetAt: Date, periodEnd: Date | null | undefined, now: Date): boolean {
  return lastResetAt.getTime() < quotaWindow(periodEnd, now).start.getTime()
}

/**
 * Generations used in the CURRENT quota window. The stored counter is only zeroed lazily (when the user next
 * generates, or by the daily sweep), so every place that DISPLAYS usage must go through this instead of reading
 * `campaignsUsedThisMonth` directly — otherwise an inactive user shows last period's "3/5" forever.
 */
export function effectiveUsed(
  user: { campaignsUsedThisMonth: number; lastResetAt: Date },
  periodEnd: Date | null | undefined,
  now: Date = new Date(),
): number {
  return needsBillingReset(user.lastResetAt, periodEnd, now) ? 0 : user.campaignsUsedThisMonth
}
