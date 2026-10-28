'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { CHANNEL_LABEL, CHANNEL_URL, lengthIssue, type Channel, type DerivedStatus } from '@/lib/social/plan'
import { scanText } from '@/lib/compliance/fair-housing'

export interface PostView {
  id: string; channel: Channel; body: string; status: string; derived: DerivedStatus; notes: string
  scheduledLocal: string; property: string; week: number | null
}

const BADGE: Record<DerivedStatus, string> = {
  draft: 'bg-slate-100 text-slate-600', scheduled: 'bg-blue-100 text-blue-800', due: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-700', posted: 'bg-green-100 text-green-700', skipped: 'bg-slate-100 text-slate-500',
}
const LABEL: Record<DerivedStatus, string> = { draft: 'Draft', scheduled: 'Scheduled', due: 'Due', overdue: 'Overdue', posted: 'Posted', skipped: 'Skipped' }

export function SocialPostCard({ post }: { post: PostView }) {
  const router = useRouter()
  const [body, setBody] = useState(post.body)
  const [when, setWhen] = useState(post.scheduledLocal)
  const [notes, setNotes] = useState(post.notes)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')
  const findings = useMemo(() => scanText(body), [body])
  const issue = lengthIssue(post.channel, body)
  const done = post.derived === 'posted'

  async function call(init: RequestInit) {
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, { ...init, headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error()
      setEditing(false)
      router.refresh()
    } catch { setErr('Could not update. Try again.') } finally { setBusy(false) }
  }
  const patch = (b: object) => call({ method: 'PATCH', body: JSON.stringify(b) })

  async function copy() {
    try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { setErr('Copy failed. Select the text and copy it manually.') }
  }

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className={`px-2 py-0.5 rounded-full font-semibold ${BADGE[post.derived]}`}>{LABEL[post.derived]}</span>
        <span className="font-semibold text-slate-800">{CHANNEL_LABEL[post.channel]}</span>
        <span className="text-slate-500">{post.property}{post.week ? ` · Week ${post.week}` : ''}</span>
        <input type="datetime-local" aria-label="Scheduled time" value={when} disabled={busy} onChange={e => setWhen(e.target.value)}
          onBlur={() => { if (when && when !== post.scheduledLocal) patch({ scheduledLocal: when }) }}
          className="ml-auto text-xs border border-slate-200 rounded-lg px-2 py-1" />
      </div>

      {editing
        ? <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} maxLength={5000} className="mt-3 w-full text-sm border border-slate-200 rounded-lg p-3" aria-label="Post text" />
        : <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{body}</p>}

      {issue && <p className="mt-2 text-xs text-red-600">{issue}</p>}
      {findings.length > 0 && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Fair Housing check: {findings.slice(0, 3).map(f => `“${f.match}”`).join(', ')}{findings.length > 3 ? ` +${findings.length - 3} more` : ''}. {findings[0].message}
        </p>
      )}

      <input value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes !== post.notes) patch({ notes }) }} maxLength={500} placeholder="Notes (optional)" aria-label="Notes"
        className="mt-3 w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5" />

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
        <a href={CHANNEL_URL[post.channel]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><ExternalLink className="w-3.5 h-3.5" />Open {CHANNEL_LABEL[post.channel]}</a>
        {editing
          ? <>
              <button type="button" disabled={busy || !body.trim()} onClick={() => patch({ body })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-50">Save text</button>
              <button type="button" onClick={() => { setBody(post.body); setEditing(false) }} className="text-xs text-slate-500 px-2">Cancel</button>
            </>
          : <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Edit</button>}
        <span className="ml-auto flex items-center gap-2">
          {done
            ? <button type="button" disabled={busy} onClick={() => patch({ status: 'scheduled' })} className="text-xs text-slate-500 underline">Undo posted</button>
            : <button type="button" disabled={busy} onClick={() => patch({ status: 'posted' })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white">Mark posted</button>}
          <button type="button" disabled={busy} onClick={() => patch({ status: 'skipped' })} className="text-xs text-slate-500 underline">Skip</button>
          <button type="button" disabled={busy} aria-label="Remove post" title="Remove from calendar" onClick={() => { if (confirm('Remove this post from your calendar?')) call({ method: 'DELETE' }) }} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
        </span>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </article>
  )
}
