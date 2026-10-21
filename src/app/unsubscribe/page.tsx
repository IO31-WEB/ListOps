import Link from 'next/link'
import { decodeEmailParam, verifyEmailToken } from '@/lib/unsubscribe'
import { suppressEmail, SUPPORT_EMAIL } from '@/lib/email'
import { captureError } from '@/lib/monitoring'

export const metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Visiting this page IS the unsubscribe (one page visit, no login, no extra steps — CAN-SPAM).
 * We use the signed token so only the real recipient's link works.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e = '', t = '' } = await searchParams
  const email = decodeEmailParam(e)
  let state: 'done' | 'invalid' | 'error' = 'invalid'

  if (email && verifyEmailToken(email, t)) {
    try {
      await suppressEmail(email, 'unsubscribe')
      state = 'done'
    } catch (err) {
      captureError(err, { page: 'unsubscribe' })
      state = 'error'
    }
  }

  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-6">
      <div className="max-w-md text-center bg-white rounded-2xl border border-slate-200 p-10 shadow-sm">
        {state === 'done' && (
          <>
            <h1 className="font-display text-2xl font-semibold text-slate-900">You&apos;re unsubscribed</h1>
            <p className="text-slate-600 mt-3 text-sm">{email} will no longer receive marketing emails from ListOps. This can take a few minutes to apply to messages already queued.</p>
          </>
        )}
        {state === 'invalid' && (
          <>
            <h1 className="font-display text-2xl font-semibold text-slate-900">This link isn&apos;t valid</h1>
            <p className="text-slate-600 mt-3 text-sm">The unsubscribe link is incomplete or has been altered. Email <a className="underline" href={`mailto:${SUPPORT_EMAIL}?subject=unsubscribe`}>{SUPPORT_EMAIL}</a> and we&apos;ll remove you manually.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="text-slate-600 mt-3 text-sm">We couldn&apos;t process that just now. Please try the link again, or email <a className="underline" href={`mailto:${SUPPORT_EMAIL}?subject=unsubscribe`}>{SUPPORT_EMAIL}</a>.</p>
          </>
        )}
        <Link href="/" className="inline-block mt-6 text-sm text-amber-700 underline">Back to ListOps</Link>
      </div>
    </main>
  )
}
