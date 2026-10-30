'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const field = 'rounded-lg border border-slate-300 bg-white px-3 py-2 min-h-11 sm:min-h-9 text-base sm:text-sm min-w-0'

/** "Mark paid": records that the admin already sent the money (PayPal/Zelle/etc.) for everything payable to this referrer. */
export function PayForm({ referrerId, payableLabel, payoutEmail }: { referrerId: string; payableLabel: string; payoutEmail: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState('paypal')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.confirm(`Mark ${payableLabel} as PAID? Only do this after the money has been sent${payoutEmail ? ` to ${payoutEmail}` : ''}.`)) return
    setBusy(true); setErr('')
    const res = await fetch('/api/admin/referrals/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referrerId, method, reference }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { setOpen(false); setReference(''); router.refresh() } else setErr(String(data.error ?? 'Failed'))
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-lg bg-slate-900 px-3 py-2 min-h-11 sm:min-h-9 text-sm font-medium text-white w-full sm:w-auto">Mark paid</button>
  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <select className={field} value={method} onChange={e => setMethod(e.target.value)} aria-label="Payout method">
        {['paypal', 'zelle', 'venmo', 'ach', 'check', 'other'].map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <input className={`${field} sm:w-56`} placeholder="Transaction id / note (required)" value={reference} onChange={e => setReference(e.target.value)} minLength={3} required />
      <button className="rounded-lg bg-amber-500 px-3 py-2 min-h-11 sm:min-h-9 text-sm font-semibold text-slate-900 disabled:opacity-50" disabled={busy}>{busy ? 'Saving…' : 'Confirm paid'}</button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 underline min-h-11 sm:min-h-0">Cancel</button>
      {err && <span role="alert" className="text-sm text-red-700">{err}</span>}
    </form>
  )
}
