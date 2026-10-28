'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, QrCode } from 'lucide-react'
import { PLACEMENT_LABEL } from '@/lib/qr/codes'
import type { QrRow } from '@/lib/qr/load'

export function QrPanel({ campaignId, rows, allowed, published }: { campaignId: string; rows: QrRow[]; allowed: boolean; published: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  async function create(placement: string) {
    setBusy(placement); setErr('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/qr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placement }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not create the QR code.')
      router.refresh()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create the QR code.') } finally { setBusy(null) }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2"><QrCode className="w-4 h-4 text-slate-400" /> QR codes &amp; scans</h2>
      <p className="text-xs text-slate-500 mt-1">One code per place you print it, so you can see which one gets scanned. Each code opens this listing&apos;s microsite. Flyers made on a Starter+ plan include a QR code automatically.</p>
      {!allowed
        ? <p className="text-sm text-slate-500 mt-4">Trackable QR codes are a Starter feature. <a href="/dashboard/billing" className="underline font-semibold">See plans</a></p>
        : (
          <>
            {!published && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">Publish the microsite first. A QR code for an unpublished listing sends people to the ListOps home page.</p>}
            <table className="w-full text-sm mt-4">
              <thead><tr className="text-xs text-slate-400 text-left"><th className="font-medium py-1">Placement</th><th className="font-medium py-1 text-right">Scans (30 days)</th><th className="font-medium py-1 text-right">All time</th><th /></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.placement} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{PLACEMENT_LABEL[r.placement]}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{r.code ? r.scans30 : '—'}</td>
                    <td className="py-2 text-right text-slate-600">{r.code ? r.scansAll : '—'}</td>
                    <td className="py-2 text-right">
                      {r.code
                        ? <a href={`/api/qr/${r.code}?download=1`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline"><Download className="w-3.5 h-3.5" />SVG</a>
                        : <button type="button" disabled={busy !== null} onClick={() => create(r.placement)} className="text-xs font-semibold px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50">{busy === r.placement ? 'Creating…' : 'Create'}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {err && <p role="alert" className="text-xs text-red-600 mt-2">{err}</p>}
            <p className="text-xs text-slate-400 mt-3">A scan is counted when a phone opens the QR link. Bots, your own signed-in scans and over-limit traffic are skipped. Counts are scans, not unique people. Codes can&apos;t be deleted, so signs already printed keep working. The SVG is vector: send it to your sign printer at any size.</p>
          </>
        )}
    </div>
  )
}
