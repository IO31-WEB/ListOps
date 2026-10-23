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
    <section className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-slate-900 mb-3">{title}</h2>}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

export const th = 'text-left text-xs font-medium text-slate-500 px-3 py-2 border-b border-slate-200 whitespace-nowrap'
export const td = 'px-3 py-2 text-sm text-slate-700 border-b border-slate-100 align-top'
