'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const btn = 'text-xs font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 rounded-lg px-3 py-2 min-h-[36px] disabled:opacity-50'

async function call(url: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, init)
    if (res.ok) return null
    const d = await res.json().catch(() => ({}))
    return d.error ?? 'Something went wrong.'
  } catch { return 'Network error. Please try again.' }
}

export function RemoveMemberButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    if (!window.confirm(`Remove ${name} from your team? They keep their own content and move to a free workspace. This frees the seat.`)) return
    setBusy(true); setErr('')
    const e = await call(`/api/team/members/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (e) setErr(e); else router.refresh()
  }
  return <span><button type="button" className={btn} disabled={busy} onClick={go}>{busy ? 'Removing…' : 'Remove'}</button>{err && <span role="alert" className="block text-xs text-red-700 mt-1">{err}</span>}</span>
}

export function RevokeInviteButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    const e = await call('/api/team/invite', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setBusy(false)
    if (e) setErr(e); else router.refresh()
  }
  return <span><button type="button" className={btn} disabled={busy} onClick={go}>{busy ? 'Cancelling…' : 'Cancel invite'}</button>{err && <span role="alert" className="block text-xs text-red-700 mt-1">{err}</span>}</span>
}
