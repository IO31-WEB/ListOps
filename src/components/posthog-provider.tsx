'use client'

import { Suspense, useEffect } from 'react'
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
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com',
      capture_pageview: false,
      persistence: 'localStorage',
    })
    posthog = ph
    return ph
  } catch {
    return null
  }
}

// Inner component that uses useSearchParams — must be inside Suspense
function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { userId } = useAuth()

  useEffect(() => {
    const ph = initPostHog()
    if (!ph) return
    if (userId) ph.identify(userId)
  }, [userId])

  useEffect(() => {
    const ph = initPostHog()
    if (!ph) return
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '')
    ph.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}

// Exported wrapper — Suspense boundary here so it never blocks page rendering
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </>
  )
}
