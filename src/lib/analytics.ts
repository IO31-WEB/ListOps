'use client'

/**
 * Tiny funnel-analytics helper (PostHog is already initialized in posthog-provider.tsx).
 * Never throws and never blocks the UI. Event names are the generate funnel:
 *
 *   generate_page_viewed -> address_entered -> enrich_clicked/enrich_result ->
 *   photos_added -> generate_clicked -> generate_succeeded | generate_failed
 *
 * In PostHog: Insights -> Funnels, add those steps in order to see where agents drop off.
 * Do NOT put PII (addresses, names, emails) in properties — counts and categories only.
 */
export function track(event: string, props?: Record<string, string | number | boolean | null>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ph = require('posthog-js')
    if (ph?.__loaded) ph.capture(event, props)
  } catch {
    /* analytics must never break the app */
  }
}
