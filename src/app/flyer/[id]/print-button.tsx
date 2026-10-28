'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { canAccess, type PlanTier } from '@/lib/plans'
import { COLOR_SCHEMES } from '@/lib/color-schemes'
import { DocToolbar } from '@/components/print/doc-toolbar'

const TEMPLATES = [
  { id: 'classic', label: 'Heritage', desc: 'Full-bleed hero, floating address card' },
  { id: 'luxury', label: 'Maison', desc: 'Dark editorial with gold framing' },
  { id: 'modern', label: 'Atelier', desc: 'Split layout, bold type' },
]
const BADGES = [
  { id: 'justListed', label: 'Just Listed' },
  { id: 'openHouse', label: 'Open House' },
  { id: 'priceReduced', label: 'Price Improvement' },
]

export function PrintButton({ flyerId, backUrl, planTier, initialTemplate, initialScheme, initialBadge, initialDate, initialTime, initialWas }: {
  flyerId: string
  backUrl: string
  planTier: string
  initialTemplate: string
  initialScheme: string
  initialBadge: string
  initialDate: string
  initialTime: string
  initialWas: string
}) {
  const plan = planTier as PlanTier
  const [template, setTemplate] = useState(initialTemplate || 'classic')
  const [scheme, setScheme] = useState(initialScheme || 'brand')
  const [badge, setBadge] = useState(initialBadge || 'justListed')
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  const [was, setWas] = useState(initialWas)
  const [busy, setBusy] = useState(false)

  const templatesOk = canAccess(plan, 'flyer_templates')
  const variantsOk = canAccess(plan, 'flyer_variants')
  const schemesOk = canAccess(plan, 'flyer_schemes')

  const params = (over: Record<string, string> = {}) => {
    const p: Record<string, string> = { template, scheme, badge, ...over }
    if (date) p.date = date
    if (time) p.time = time
    if (was && /^\d+$/.test(was)) p.was = was
    return p
  }
  const go = (over: Record<string, string> = {}) => {
    const url = new URL(window.location.href)
    url.search = new URLSearchParams(params(over)).toString()
    window.location.href = url.toString()
  }

  const downloadPdf = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/campaigns/${flyerId}/pdf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params()),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create the PDF')
      if (data.isPdf) window.open(data.url, '_blank', 'noopener')
      else { toast('Opening print view — choose “Save as PDF”.'); window.print() }
    } catch (e: any) {
      toast.error(e.message || 'Could not create the PDF')
    } finally { setBusy(false) }
  }

  const pill = (active: boolean, locked = false) =>
    `text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
      active ? 'bg-slate-900 text-white border-slate-900'
      : locked ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`

  const label = 'text-xs font-semibold text-slate-400 uppercase tracking-wide'
  return (
    <DocToolbar backUrl={backUrl} title="Listing flyer" busy={busy} onDownload={downloadPdf}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={label}>Style</span>
        {TEMPLATES.map((t, i) => {
          const locked = i > 0 && !templatesOk
          return <button key={t.id} disabled={locked} title={locked ? 'Upgrade to Starter to unlock' : t.desc} onClick={() => go({ template: t.id })} className={pill(template === t.id, locked)}>{t.label}{locked ? ' 🔒' : ''}</button>
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={label}>Flyer</span>
        {BADGES.map((b, i) => {
          const locked = i > 0 && !variantsOk
          return <button key={b.id} disabled={locked} title={locked ? 'Upgrade to Starter to unlock' : ''} onClick={() => go({ badge: b.id })} className={pill(badge === b.id, locked)}>{b.label}{locked ? ' 🔒' : ''}</button>
        })}
      </div>

      {variantsOk && badge === 'openHouse' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input value={date} onChange={e => setDate(e.target.value)} maxLength={40} placeholder="Sat, Nov 8" aria-label="Open house date" className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
          <input value={time} onChange={e => setTime(e.target.value)} maxLength={40} placeholder="1–4 PM" aria-label="Open house time" className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
          <button onClick={() => go()} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-semibold">Apply</button>
        </div>
      )}
      {variantsOk && badge === 'priceReduced' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input value={was} onChange={e => setWas(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={9} placeholder="Previous price" aria-label="Previous price" className="w-32 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
          <button onClick={() => go()} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-semibold">Apply</button>
        </div>
      )}

      {schemesOk ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={label}>Colors</span>
          {COLOR_SCHEMES.map(s => (
            <button key={s.id} title={s.desc} onClick={() => go({ scheme: s.id })}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${scheme === s.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'}`}>{s.label}</button>
          ))}
        </div>
      ) : (
        <a href="/dashboard/billing" className="text-xs text-amber-600 font-semibold hover:underline">Upgrade to Pro for 5 color schemes</a>
      )}
    </DocToolbar>
  )
}
