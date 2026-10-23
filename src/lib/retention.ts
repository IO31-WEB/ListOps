/**
 * DATA-RETENTION POLICY (single source of truth — mirrored in the Privacy Policy and MIGRATION docs).
 *
 *   Closed accounts (deleted_at set)     content purged + personal data anonymized after 30 days
 *   Failed campaigns                     deleted after 90 days
 *   AI usage ledger                      deleted after 400 days
 *   Audit log                            deleted after 730 days (2 years)
 *   Processed Stripe event ids           deleted after 90 days
 *   Orphan listing photos                deleted after 24 h (see /api/cron/cleanup-uploads)
 *   Email suppression list               kept indefinitely (needed so we never email an opted-out address again)
 *   Billing records                      kept in Stripe per tax/financial-record law (not deleted by this app)
 *
 * Executed daily by /api/cron/retention. Everything it does is idempotent, so a failed run is simply retried.
 */
export const RETENTION = {
  closedAccountDays: 30,
  failedCampaignDays: 90,
  aiUsageDays: 400,
  auditLogDays: 730,
  stripeEventDays: 90,
} as const

export const daysAgoDate = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** Convert one of OUR public R2 URLs back into its object key (returns null for anything else). */
export function r2KeyFromUrl(url: string | null | undefined, publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL): string | null {
  if (!url || !publicBase) return null
  const base = publicBase.replace(/\/$/, '') + '/'
  if (!url.startsWith(base)) return null
  const key = url.slice(base.length).split('?')[0]
  return key && !key.includes('..') ? key : null
}
