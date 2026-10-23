import Link from 'next/link'

export const metadata = { title: 'Account closed', robots: { index: false } }

export default function AccountClosedPage() {
  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-semibold text-slate-900">This account has been closed</h1>
        <p className="text-slate-600 mt-4">Your data is scheduled for permanent deletion. If you think this is a mistake, contact us within 30 days and we can help.</p>
        <Link href="/contact" className="inline-block mt-8 bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl">Contact support</Link>
      </div>
    </main>
  )
}
