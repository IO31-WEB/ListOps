import Link from 'next/link'
import { LogoMark } from '@/components/ui/logo'
import { pageMetadata } from '@/lib/seo'
import { REFUND_CLAUSES, REFUND_EMAIL } from '@/lib/refund-policy'

export const metadata = pageMetadata({ title: 'Refund Policy', description: 'How refunds, cancellations and free trials work on ListOps subscriptions.', path: '/refunds' })

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-amber-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8" />
            <span className="font-display font-semibold text-slate-900 text-lg">ListOps</span>
          </Link>
        </div>
      </nav>
      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-semibold text-slate-900 mb-3">Refund Policy</h1>
        <p className="text-slate-500 text-sm mb-10">Part of our <Link href="/terms#refunds" className="underline">Terms of Service</Link>. Questions? <a href={`mailto:${REFUND_EMAIL}`} className="underline">{REFUND_EMAIL}</a></p>
        <div className="space-y-7 text-slate-600 leading-relaxed">
          {REFUND_CLAUSES.map(c => (
            <div key={c.title}>
              <h2 className="font-display text-lg font-semibold text-slate-900 mb-1.5">{c.title}</h2>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
