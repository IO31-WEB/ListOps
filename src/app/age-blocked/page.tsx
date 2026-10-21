import Link from 'next/link'

export const metadata = { title: 'Account unavailable', robots: { index: false } }

export default function AgeBlockedPage() {
  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-semibold text-slate-900">ListOps is for adults only</h1>
        <p className="text-slate-600 mt-4">You must be at least 18 years old to use ListOps, so we&apos;ve closed this account. If this was a mistake, contact us and we&apos;ll help.</p>
        <Link href="/contact" className="inline-block mt-8 bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl">Contact support</Link>
      </div>
    </main>
  )
}
