'use client'

/**
 * PostHog Browser Provider
 * Wraps the app for client-side pageview tracking and feature flags.
 * Only initializes if NEXT_PUBLIC_POSTHOG_KEY is set.
 *
 * Add to Vercel env vars:
 *   NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
 *   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
 */

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

let posthog: any = null

function initPostHog() {
  if (posthog) return posthog
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || typeof window === 'undefined') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ph = require('posthog-js')
    ph.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      capture_pageview: false, // We manually track below
      persistence: 'localStorage',
    })
    posthog = ph
    return ph
  } catch {
    return null
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { userId } = useAuth()

  // Identify user when logged in
  useEffect(() => {
    const ph = initPostHog()
    if (!ph) return
    if (userId) {
      ph.identify(userId)
    }
  }, [userId])

  // Track pageviews on route change
  useEffect(() => {
    const ph = initPostHog()
    if (!ph) return
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '')
    ph.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return <>{children}</>
}
