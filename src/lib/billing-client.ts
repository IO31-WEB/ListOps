'use client'

/**
 * Shared, de-duplicated client fetch for /api/billing/info.
 *
 * PERF: the sidebar, header and each page used to call this endpoint independently — 3-5 identical requests
 * per page load, each hitting the server (and previously Clerk). Now concurrent callers share one in-flight
 * request and results are reused for 30 seconds. Call invalidateBillingInfo() after anything that changes
 * usage or plan (generating a campaign, returning from Stripe) and pass force=true on the billing page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BillingInfo = Record<string, any>

const TTL_MS = 30_000
let cache: { at: number; data: BillingInfo } | null = null
let inflight: Promise<BillingInfo | null> | null = null

export function invalidateBillingInfo() {
  cache = null
}

export function getBillingInfo(force = false): Promise<BillingInfo | null> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.data)
  if (!force && inflight) return inflight
  inflight = fetch('/api/billing/info')
    .then(r => (r.ok ? (r.json() as Promise<BillingInfo>) : null))
    .then(data => {
      if (data) cache = { at: Date.now(), data }
      return data
    })
    .catch(() => null)
    .finally(() => { inflight = null })
  return inflight
}
