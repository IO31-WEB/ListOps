import type { ReactNode } from 'react'

export const usd = (n: number) => `$${n.toFixed(2)}`
export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—'

export function Badge({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'slate'; children: ReactNode }) {
  const cls = { green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800', slate: 'bg-slate-100 text-slate-700' }[tone]
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

export const statusTone = (s: string) => (s === 'complete' ? 'green' : s === 'failed' ? 'red' : s === 'generating' ? 'amber' : 'slate') as 'green' | 'red' | 'amber' | 'slate'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-xl p-3 sm:p-5 min-w-0 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-slate-900 mb-3 break-words">{title}</h2>}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 min-w-0">
      <div className="text-[11px] sm:text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold text-slate-900 mt-1 break-words">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1 break-words">{sub}</div>}
    </div>
  )
}

/** Desktop table wrapper (hidden on phones; pair with <MobileList>). Scrolls inside itself if ever too wide. */
export function DesktopTable({ children }: { children: ReactNode }) {
  return <div className="hidden md:block overflow-x-auto"><table className="w-full">{children}</table></div>
}

/** Phone-only stacked card list (hidden from md up; pair with <DesktopTable>). */
export function MobileList({ children }: { children: ReactNode }) {
  return <ul className="md:hidden space-y-2">{children}</ul>
}

export function MobileItem({ children }: { children: ReactNode }) {
  return <li className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700 space-y-1.5 min-w-0 break-words">{children}</li>
}

/** Label/value line inside a mobile card. */
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 min-w-0">
      <span className="w-20 shrink-0 text-xs text-slate-500 pt-0.5">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  )
}

/** Link style with a comfortable touch target on phones. */
export const linkCls = 'text-amber-700 underline break-all'

export const th = 'text-left text-xs font-medium text-slate-500 px-3 py-2 border-b border-slate-200 whitespace-nowrap'
export const td = 'px-3 py-2 text-sm text-slate-700 border-b border-slate-100 align-top'

/** Search form controls: 16px text on phones (no iOS zoom), >=44px tall. */
export const searchInputCls = 'flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 min-h-11 text-base sm:text-sm'
export const searchBtnCls = 'rounded-lg bg-slate-900 px-5 min-h-11 text-sm font-medium text-white'
