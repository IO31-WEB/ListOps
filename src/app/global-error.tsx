'use client'

import { useEffect } from 'react'

/** Last-resort boundary (errors in the root layout). Must render its own <html>/<body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@sentry/nextjs').captureException(error)
    } catch {
      /* ignore */
    }
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#faf8f5', color: '#0f172a' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 32, margin: 0 }}>ListOps hit a snag</h1>
            <p style={{ color: '#475569', marginTop: 16 }}>We&apos;ve been notified and are looking into it. Please try again.</p>
            {error.digest && <p style={{ fontSize: 12, color: '#94a3b8' }}>Reference: {error.digest}</p>}
            <button onClick={reset} style={{ marginTop: 24, background: '#0f172a', color: '#fff', border: 0, borderRadius: 12, padding: '12px 24px', fontWeight: 600, cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
