'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/** Route-level error boundary. Shows a branded message + a reference id; never the stack. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@sentry/nextjs').captureException(error)
    } catch {
      /* Sentry not available — ignore */
    }
  }, [error])

  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold tracking-widest text-amber-600 uppercase">Something went wrong</p>
        <h1 className="font-display text-4xl font-semibold text-slate-900 mt-3">We hit a snag</h1>
        <p className="text-slate-600 mt-4">
          That one&apos;s on us — we&apos;ve been notified. Try again, and if it keeps happening, reach out and we&apos;ll sort it out.
        </p>
        {error.digest && <p className="text-xs text-slate-400 mt-3">Reference: {error.digest}</p>}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="inline-flex items-center justify-center bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors">
            Try again
          </button>
          <Link href="/contact" className="inline-flex items-center justify-center border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors">
            Contact support
          </Link>
        </div>
      </div>
    </main>
  )
}
