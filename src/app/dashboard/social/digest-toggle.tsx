'use client'

import { useState } from 'react'

export function DigestToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [err, setErr] = useState('')
  async function change(next: boolean) {
    const prev = on; setOn(next); setErr('')
    try {
      const res = await fetch('/api/social/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ digest: next }) })
      if (!res.ok) throw new Error()
    } catch { setOn(prev); setErr('Could not save. Try again.') }
  }
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">Daily &quot;posts due&quot; email</div>
        <div className="text-xs text-slate-500 mt-0.5">One email the morning posts are due, with the text ready to copy. Sent once per post.</div>
        {err && <div className="text-xs text-red-600 mt-1">{err}</div>}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={on} onChange={e => change(e.target.checked)} /> {on ? 'On' : 'Off'}</label>
    </div>
  )
}
