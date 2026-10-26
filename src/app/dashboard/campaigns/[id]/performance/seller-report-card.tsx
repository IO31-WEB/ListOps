'use client'

import { useEffect, useState } from 'react'

interface Report { url: string; note: string; views: number; lastViewedAt: string | null; createdAt: string }

export function SellerReportCard({ campaignId, allowed }: { campaignId: string; allowed: boolean }) {
  const [report, setReport] = useState<Report | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const base = `/api/campaigns/${campaignId}/seller-report`

  useEffect(() => {
    if (!allowed) return
    fetch(base).then(r => (r.ok ? r.json() : null)).then(d => { if (d?.report) { setReport(d.report); setNote(d.report.note) } }).catch(() => {})
  }, [base, allowed])

  async function call(method: 'POST' | 'DELETE') {
    setBusy(true); setMsg('')
    try {
      const res = await fetch(base, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ note }) : undefined })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(body.error || 'Something went wrong.'); return }
      if (method === 'POST') { setReport(body.report); setMsg('New link created. Any older link no longer works.') } else { setReport(null); setMsg('Link revoked.') }
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }

  async function copy() {
    if (!report) return
    try { await navigator.clipboard.writeText(report.url); setMsg('Link copied.') } catch { setMsg('Select the link and copy it.') }
  }

  if (!allowed) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-display font-semibold text-slate-900">Seller report</h2>
        <p className="text-sm text-slate-500 mt-1">Send your seller a branded, always-current activity report. Available on the Pro plan and above.</p>
        <a href="/dashboard/billing" className="inline-block mt-3 text-sm font-semibold text-amber-700 underline">See plans</a>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
      <div>
        <h2 className="font-display font-semibold text-slate-900">Seller report</h2>
        <p className="text-sm text-slate-500 mt-1">A private link that shows your seller this listing&apos;s real activity — views, clicks and inquiry counts (never buyers&apos; names or contact details). It updates as new activity arrives.</p>
      </div>
      <label className="block text-xs font-semibold text-slate-600" htmlFor="sr-note">Note to the seller (optional)</label>
      <textarea id="sr-note" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="e.g. Great first weekend — two showing requests so far." />
      {report && (
        <div className="bg-slate-50 rounded-xl p-3 text-sm">
          <input readOnly value={report.url} onFocus={e => e.currentTarget.select()} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" aria-label="Seller report link" />
          <div className="text-xs text-slate-500 mt-2">Opened {report.views} time{report.views === 1 ? '' : 's'}{report.lastViewedAt ? ` · last ${new Date(report.lastViewedAt).toLocaleString()}` : ''}</div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" disabled={busy} onClick={() => call('POST')} className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 disabled:opacity-60">{report ? 'Create new link' : 'Create report link'}</button>
        {report && <>
          <button type="button" onClick={copy} className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Copy link</button>
          <a href={report.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Preview</a>
          <button type="button" disabled={busy} onClick={() => { if (confirm('Revoke this link? Anyone who has it will lose access.')) call('DELETE') }} className="text-sm font-semibold px-4 py-2 rounded-xl text-red-600 hover:bg-red-50">Revoke</button>
        </>}
        {msg && <span role="status" className="text-xs text-slate-600">{msg}</span>}
      </div>
    </div>
  )
}
