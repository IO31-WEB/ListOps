'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Lock, ImageOff } from 'lucide-react'
import { getBillingInfo } from '@/lib/billing-client'
import { canAccess, type PlanTier } from '@/lib/plans'
import { COLOR_SCHEMES } from '@/lib/color-schemes'
import { KIT_CATALOG, KIT_KINDS, kindAllowed, kitWatermarked, type KitKind } from '@/lib/visual-kit/catalog'

export default function VisualKitPage() {
  const { id } = useParams<{ id: string }>()
  const [plan, setPlan] = useState<PlanTier>('free')
  const [scheme, setScheme] = useState('brand')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [oldPrice, setOldPrice] = useState('')
  // Inputs apply on "Update previews" so typing doesn't trigger a render per keystroke.
  const [applied, setApplied] = useState({ scheme: 'brand', date: '', time: '', oldPrice: '' })
  const [failed, setFailed] = useState<Record<string, string>>({})

  useEffect(() => {
    getBillingInfo().then(b => { if (b?.planTier) setPlan(b.planTier as PlanTier) }).catch(() => {})
  }, [])

  const pdfOk = canAccess(plan, 'visual_kit_pdf')
  const schemesOk = canAccess(plan, 'flyer_schemes')
  const watermarked = kitWatermarked(plan)

  const qs = (kind: KitKind, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ kind, scheme: schemesOk ? applied.scheme : 'brand', ...extra })
    if (applied.date) p.set('date', applied.date)
    if (applied.time) p.set('time', applied.time)
    if (applied.oldPrice && /^\d+$/.test(applied.oldPrice)) p.set('oldPrice', applied.oldPrice)
    return `/api/campaigns/${id}/visual-kit?${p.toString()}`
  }
  const version = useMemo(() => JSON.stringify(applied), [applied])

  const showFailure = async (kind: string, url: string) => {
    // The <img> error event has no body; re-request to read the server's plain-language message.
    try {
      const r = await fetch(url)
      const j = await r.json().catch(() => null)
      setFailed(f => ({ ...f, [kind]: j?.error ?? 'Preview unavailable right now.' }))
    } catch {
      setFailed(f => ({ ...f, [kind]: 'Preview unavailable right now.' }))
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <Link href={`/dashboard/campaigns/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" />Back to campaign
        </Link>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Branded Visual Kit</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ready-to-post graphics built from this listing, your photos and your brand kit. Nothing here is invented — every number comes from your listing.
        </p>
        {watermarked && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 inline-block">
            Free plan: Instagram post only, with a small “Made with ListOps” mark. <Link href="/dashboard/billing" className="font-semibold underline">Upgrade</Link> for all six graphics, your brand kit and no watermark.
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Open house date
          <input value={date} onChange={e => setDate(e.target.value)} maxLength={40} placeholder="Sat, Nov 8" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Time
          <input value={time} onChange={e => setTime(e.target.value)} maxLength={40} placeholder="1–4 PM" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Previous price ($)
          <input value={oldPrice} onChange={e => setOldPrice(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={9} placeholder="525000" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
        </label>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Colors</div>
          <select value={scheme} onChange={e => setScheme(e.target.value)} disabled={!schemesOk} title={schemesOk ? '' : 'Color schemes are a Pro feature'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400">
            {COLOR_SCHEMES.map(s => <option key={s.id} value={s.id}>{s.label} — {s.desc}</option>)}
          </select>
        </div>
        <button onClick={() => { setFailed({}); setApplied({ scheme, date, time, oldPrice }) }}
          className="bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800">Update previews</button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {KIT_KINDS.map(kind => {
          const meta = KIT_CATALOG[kind]
          const allowed = kindAllowed(plan, kind)
          const url = qs(kind)
          const err = failed[kind]
          return (
            <div key={kind} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-100 flex items-center justify-center p-3" style={{ aspectRatio: `${meta.width} / ${meta.height > 1500 ? 1100 : meta.height}`, minHeight: 180 }}>
                {!allowed ? (
                  <div className="text-center text-slate-500 text-sm px-6"><Lock className="w-6 h-6 mx-auto mb-2 text-slate-400" />Included with Starter and above</div>
                ) : err ? (
                  <div className="text-center text-slate-500 text-sm px-6"><ImageOff className="w-6 h-6 mx-auto mb-2 text-slate-400" />{err}</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={version} src={url} alt={`${meta.label} preview`} loading="lazy" onError={() => showFailure(kind, url)}
                    className="max-h-[420px] w-auto max-w-full rounded-md shadow-sm" />
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                <div>
                  <div className="font-display font-semibold text-slate-900">{meta.label}</div>
                  <div className="text-xs text-slate-500">{meta.desc}</div>
                  {kind === 'open-house' && !applied.date && <div className="text-xs text-amber-700 mt-1">Add the date and time above, then Update previews.</div>}
                  {kind === 'price-reduced' && !applied.oldPrice && <div className="text-xs text-amber-700 mt-1">Add the previous price above to show old → new.</div>}
                </div>
                <div className="flex gap-2 mt-auto">
                  <a href={allowed ? qs(kind, { format: 'png', download: '1' }) : '/dashboard/billing'}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg ${allowed ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400'}`}>
                    <Download className="w-3.5 h-3.5" />PNG
                  </a>
                  <a href={allowed && pdfOk ? qs(kind, { format: 'pdf', download: '1' }) : '/dashboard/billing'}
                    title={pdfOk ? '' : 'PDF export is a Pro feature'}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border ${allowed && pdfOk ? 'border-slate-300 text-slate-700 hover:bg-slate-50' : 'border-slate-100 text-slate-300'}`}>
                    <FileText className="w-3.5 h-3.5" />PDF{pdfOk ? '' : ' 🔒'}
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400">
        Agent details, logos and colors come from your <Link href="/dashboard/brand" className="underline">Brand Kit</Link>. WebP photos are skipped in graphics (use JPG or PNG). Print flyers live on the campaign page.
      </p>
    </div>
  )
}
