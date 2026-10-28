'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function LeadActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function call(init: RequestInit) {
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/leads/${id}`, { ...init, headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch { setErr('Could not update. Try again.') } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <select aria-label="Lead status" disabled={busy} value={status}
        onChange={e => call({ method: 'PATCH', body: JSON.stringify({ status: e.target.value }) })}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
        <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
      </select>
      <button type="button" disabled={busy} aria-label="Delete lead" title="Delete lead"
        onClick={() => { if (confirm('Delete this lead permanently?')) call({ method: 'DELETE' }) }}
        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  )
}
