'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: res.ok, data: await res.json().catch(() => ({})) }
}

const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const btn = 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'

export function QuotaForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<'refund' | 'grant' | 'set_used'>('refund')
  const [n, setN] = useState('1')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const body = mode === 'refund' ? { mode, reason } : mode === 'grant' ? { mode, amount: Number(n), reason } : { mode, value: Number(n), reason }
    const r = await post(`/api/admin/users/${userId}/quota`, body)
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: `Done. Used this month: ${r.data.usedBefore} → ${r.data.usedAfter}` }); setReason(''); router.refresh() }
    else setMsg({ ok: false, text: String(r.data.error ?? 'Failed') })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select className={input} value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
          <option value="refund">Refund 1 generation</option>
          <option value="grant">Grant extra generations</option>
          <option value="set_used">Set “used this month” to…</option>
        </select>
        {mode !== 'refund' && <input className={`${input} w-24`} type="number" min={mode === 'grant' ? 1 : 0} value={n} onChange={e => setN(e.target.value)} />}
      </div>
      <input className={`${input} w-full`} placeholder="Reason (required, logged) — e.g. “generation failed, ticket #123”" value={reason} onChange={e => setReason(e.target.value)} minLength={5} maxLength={300} required />
      <button className={btn} disabled={busy}>{busy ? 'Applying…' : 'Apply change'}</button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role="status">{msg.text}</p>}
    </form>
  )
}

export function RefundButton({ userId, campaignId }: { userId: string; campaignId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    const reason = window.prompt('Reason for refunding this generation (logged):', 'Generation failed')
    if (!reason || reason.trim().length < 5) return
    setBusy(true); setErr('')
    const r = await post(`/api/admin/users/${userId}/quota`, { mode: 'refund', campaignId, reason })
    setBusy(false)
    if (r.ok) router.refresh(); else setErr(String(r.data.error ?? 'Failed'))
  }
  return (
    <span>
      <button onClick={go} disabled={busy} className="text-xs underline text-amber-700 disabled:opacity-50">{busy ? '…' : 'Refund'}</button>
      {err && <span className="text-xs text-red-700 ml-2">{err}</span>}
    </span>
  )
}

export function DeleteAccountForm({ userId, email }: { userId: string; email: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const r = await post(`/api/admin/users/${userId}/delete`, { confirmEmail: confirm, reason })
    setBusy(false)
    if (r.ok) router.refresh(); else setErr(String(r.data.error ?? 'Failed'))
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-slate-600">Closes the account immediately (login removed, access blocked). Content is permanently purged after 30 days. Type <strong>{email}</strong> to confirm.</p>
      <input className={`${input} w-full`} placeholder="Type the user’s email to confirm" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      <input className={`${input} w-full`} placeholder="Reason (required, logged)" value={reason} onChange={e => setReason(e.target.value)} minLength={5} required />
      <button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy}>{busy ? 'Closing…' : 'Close account'}</button>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </form>
  )
}
