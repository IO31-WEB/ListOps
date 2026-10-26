'use client'

import type { AnchorHTMLAttributes } from 'react'

/** Anchor that reports a click to the microsite event endpoint (fire-and-forget; the link always works). */
export function TrackedLink({ slug, kind, ...rest }: { slug: string; kind: 'click_call' | 'click_email' } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      onClick={e => {
        rest.onClick?.(e)
        try {
          const body = JSON.stringify({ kind })
          const url = `/api/l/${encodeURIComponent(slug)}/event`
          if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) {
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
          }
        } catch { /* tracking must never block the click */ }
      }}
    />
  )
}
