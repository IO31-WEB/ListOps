'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { DocToolbar } from '@/components/print/doc-toolbar'
import { COLOR_SCHEMES } from '@/lib/color-schemes'
import { canAccess, type PlanTier } from '@/lib/plans'

export function BrochureToolbar({ campaignId, backUrl, planTier, initialScheme }: {
  campaignId: string; backUrl: string; planTier: string; initialScheme: string
}) {
  const [scheme, setScheme] = useState(initialScheme || 'brand')
  const [busy, setBusy] = useState(false)
  const schemesOk = canAccess(planTier as PlanTier, 'flyer_schemes')

  const go = (next: string) => {
    setScheme(next)
    const url = new URL(window.location.href)
    url.searchParams.set('scheme', next)
    window.location.href = url.toString()
  }

  const downloadPdf = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pdf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc: 'brochure', scheme }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create the PDF')
      if (data.isPdf) window.open(data.url, '_blank', 'noopener')
      else { toast('Opening print view — choose “Save as PDF”, paper size 11 × 8.5 in.'); window.print() }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the PDF')
    } finally { setBusy(false) }
  }

  return (
    <DocToolbar backUrl={backUrl} title="Tri-fold brochure" busy={busy} onDownload={downloadPdf}>
      <p className="text-xs text-slate-500 max-w-md">Print-ready tri-fold, 11 × 8.5 in, with 0.125 in bleed and safe margins — upload the PDF to your printer as-is. Page 1 is the outside, page 2 the inside.</p>
      {schemesOk ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Colors</span>
          {COLOR_SCHEMES.map(s => (
            <button key={s.id} title={s.desc} onClick={() => go(s.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${scheme === s.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'}`}>{s.label}</button>
          ))}
        </div>
      ) : (
        <a href="/dashboard/billing" className="text-xs text-amber-600 font-semibold hover:underline">Upgrade to Pro for 5 color schemes</a>
      )}
    </DocToolbar>
  )
}
