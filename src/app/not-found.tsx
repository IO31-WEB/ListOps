import Link from 'next/link'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold tracking-widest text-amber-600 uppercase">404</p>
        <h1 className="font-display text-4xl font-semibold text-slate-900 mt-3">This page isn&apos;t on the market</h1>
        <p className="text-slate-600 mt-4">
          The page you&apos;re looking for has moved, been sold, or never existed. Let&apos;s get you back on track.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="inline-flex items-center justify-center bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors">
            Go to dashboard
          </Link>
          <Link href="/contact" className="inline-flex items-center justify-center border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors">
            Contact support
          </Link>
        </div>
      </div>
    </main>
  )
}
