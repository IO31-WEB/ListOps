'use client'

import { useCallback, useEffect, useState } from 'react'
import { GROUPS, GROUP_LABEL, type Group } from '@/lib/approval/items'

interface Item { key: string; label: string; group: Group; text: string; decision: 'approved' | 'changes' | null; comment: string; signedName: string | null; decidedAt: string | null }
interface Approval {
  url: string; sellerName: string; note: string; views: number; lastViewedAt: string | null; submittedAt: string | null; createdAt: string
  summary: { total: number; approved: number; changes: number; pending: number; status: string }; items: Item[]
}
const STATUS: Record<string, [string, string]> = {
  pending: ['Waiting for your seller', 'bg-slate-100 text-slate-700'], in_progress: ['Partly answered', 'bg-blue-100 text-blue-800'],
  approved: ['Approved', 'bg-green-100 text-green-700'], changes_requested: ['Changes requested', 'bg-amber-100 text-amber-800'],
}
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '')

export function ApprovalCard({ campaignId }: { campaignId: string }) {
  const base = `/api/campaigns/${campaignId}/approval`
  const [a, setA] = useState<Approval | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [sellerName, setSellerName] = useState('')
  const [note, setNote] = useState('')
  const [groups, setGroups] = useState<Group[]>([...GROUPS])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => fetch(base, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { setA(d?.approval ?? null) }).catch(() => {}).finally(() => setLoaded(true)), [base])
  useEffect(() => { load() }, [load])

  async function call(method: 'POST' | 'DELETE') {
    if (method === 'POST' && a && !confirm('Creating a new link replaces the current one. The old link stops working and its answers are no longer shown here. Continue?')) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch(base, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ sellerName, note, groups }) : undefined })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(body.error || 'Something went wrong.'); return }
      if (method === 'POST') { setA(body.approval); setMsg('Link created. Copy it and send it to your seller.') } else { setA(null); setMsg('Link closed.') }
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }
  async function copy() { if (!a) return; try { await navigator.clipboard.writeText(a.url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { setMsg('Copy failed. Select the link and copy it manually.') } }

  if (!loaded) return <div className="text-sm text-slate-400">Loading…</div>
  const [label, cls] = STATUS[a?.summary.status ?? 'pending']

  return (
    <div className="space-y-6">
      {a && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
            <span className="text-xs text-slate-500">{a.summary.approved} approved · {a.summary.changes} need changes · {a.summary.pending} unanswered</span>
            <span className="text-xs text-slate-400 ml-auto">Opened {a.views} time{a.views === 1 ? '' : 's'}{a.lastViewedAt ? ` · last ${fmt(a.lastViewedAt)}` : ''}</span>
          </div>
          <div className="flex gap-2 mt-4">
            <input readOnly value={a.url} onFocus={e => e.currentTarget.select()} aria-label="Approval link" className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50" />
            <button type="button" onClick={copy} className="text-sm font-semibold px-4 rounded-lg bg-slate-900 text-white">{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" disabled={busy} onClick={() => call('DELETE')} className="text-sm font-semibold px-4 rounded-lg border border-slate-200 text-slate-700">Close link</button>
          </div>
          {a.submittedAt && <p className="text-xs text-slate-500 mt-3">Last answered {fmt(a.submittedAt)}{a.items.find(i => i.signedName)?.signedName ? ` by ${a.items.find(i => i.signedName)!.signedName}` : ''}. You are emailed each time your seller sends answers.</p>}

          <div className="mt-5 space-y-3">
            {GROUPS.map(g => {
              const list = a.items.filter(i => i.group === g)
              if (!list.length) return null
              return (
                <div key={g}>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{GROUP_LABEL[g]}</div>
                  {list.map(i => (
                    <div key={i.key} className="border border-slate-100 rounded-xl p-3 mb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-800">{i.label}</span>
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${i.decision === 'approved' ? 'bg-green-100 text-green-700' : i.decision === 'changes' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{i.decision === 'approved' ? 'Approved' : i.decision === 'changes' ? 'Changes requested' : 'Unanswered'}</span>
                        {i.decidedAt && <span className="text-slate-400 ml-auto">{fmt(i.decidedAt)}</span>}
                      </div>
                      <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-wrap line-clamp-4">{i.text}</p>
                      {i.decision === 'changes' && i.comment && <p className="text-sm text-amber-900 bg-amber-50 border-l-4 border-amber-400 px-3 py-2 mt-2 whitespace-pre-wrap">{i.comment}</p>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3">This shows the exact text your seller was shown. If you edit the campaign afterward, create a new link so they approve the new version.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 text-sm">{a ? 'Send a new version' : 'Create an approval link'}</h2>
        <p className="text-xs text-slate-500 mt-0.5">The link is private and unguessable. It captures the current text now, so what the seller approves can&apos;t change underneath them.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="text-xs font-medium text-slate-600">Seller&apos;s name (optional)
            <input value={sellerName} onChange={e => setSellerName(e.target.value)} maxLength={80} className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
          </label>
          <div className="text-xs font-medium text-slate-600">What to include
            <div className="mt-2 flex gap-4 flex-wrap">
              {GROUPS.map(g => <label key={g} className="flex items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" checked={groups.includes(g)} onChange={() => setGroups(c => c.includes(g) ? c.filter(x => x !== g) : [...c, g])} />{GROUP_LABEL[g]}</label>)}
            </div>
          </div>
        </div>
        <label className="block text-xs font-medium text-slate-600 mt-3">Message to your seller (optional)
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2" placeholder="Hi Maria, here is the marketing for 12 Oak St. Please review before we go live." />
        </label>
        <button type="button" disabled={busy || groups.length === 0} onClick={() => call('POST')} className="mt-4 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50">{busy ? 'Working…' : a ? 'Create new link' : 'Create link'}</button>
        {msg && <p role="status" className="text-xs text-slate-600 mt-3">{msg}</p>}
      </div>
    </div>
  )
}
