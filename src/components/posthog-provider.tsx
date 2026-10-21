'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

let posthog: any = null

function initPostHog() {
  if (posthog) return posthog
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || typeof window === 'undefined') return null

  // Honor browser privacy signals: Global Privacy Control (legally binding opt-out signal in
  // California and several other US states) and Do Not Track. If set, we load NO analytics at all.
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.globalPrivacyControl === true || navigator.doNotTrack === '1') return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ph = require('posthog-js')
    ph.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com',
      capture_pageview: false,
      persistence: 'localStorage',

      // ── PRIVACY DECISIONS (documented in the Privacy Policy, section 'Analytics') ───────────────
      // 1. SESSION REPLAY IS OFF. We do not record screens, clicks or keystrokes. Agents enter listing
      //    details, client names and payment-adjacent info; recording that is not worth the risk.
      //    Also switch it OFF in the PostHog project settings (Settings -> Session replay) — the
      //    dashboard toggle and this flag must both be off.
      disable_session_recording: true,
      // 2. If replay is ever re-enabled, it must be behind explicit consent AND these masks apply:
      //    every input (passwords, card fields, free text) masked, plus anything tagged data-ph-mask.
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: { password: true },
        maskTextSelector: '[data-ph-mask], input, textarea',
        blockSelector: '[data-ph-no-capture], iframe',
      },
      // 3. No autocapture: we send only the explicit, PII-free funnel events defined in lib/analytics.ts.
      autocapture: false,
      // 4. Anonymous visitors don't get person profiles; only signed-in users (identified by their
      //    opaque Clerk id — never name or email).
      person_profiles: 'identified_only',
      respect_dnt: true,
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
