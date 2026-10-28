'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CHANNELS, CHANNEL_LABEL, type Channel } from '@/lib/social/plan'

export function SocialPlanner({ campaigns, preselect, today }: { campaigns: { id: string; label: string; hasSocial: boolean }[]; preselect?: string; today: string }) {
  const router = useRouter()
  const [campaignId, setCampaignId] = useState(campaigns.find(c => c.id === preselect)?.id ?? campaigns[0]?.id ?? '')
  const [startDate, setStartDate] = useState(today)
  const [channels, setChannels] = useState<Channel[]>([...CHANNELS])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/social/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate, channels }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not schedule.')
      setMsg({ ok: true, text: data.created ? `Added ${data.created} post${data.created === 1 ? '' : 's'} to your calendar.${data.alreadyQueued ? ` ${data.alreadyQueued} were already queued.` : ''}` : 'Those posts are already on your calendar.' })
      router.refresh()
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not schedule.' }) } finally { setBusy(false) }
  }

  if (campaigns.length === 0) return null
  const toggle = (c: Channel) => setChannels(cur => cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-semibold text-slate-900 text-sm">Schedule a campaign</h2>
      <p className="text-xs text-slate-500 mt-0.5">Week 1 starts on the date you choose. Suggested times are defaults, not a promise of best reach. Edit any post afterward.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] mt-4">
        <label className="text-xs font-medium text-slate-600">Campaign
          <select value={campaignId} onChange={e => setCampaignId(e.target.value)} className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">Start date
          <input type="date" min={today} value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
        </label>
      </div>
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {CHANNELS.map(c => (
          <label key={c} className="flex items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" checked={channels.includes(c)} onChange={() => toggle(c)} /> {CHANNEL_LABEL[c]}</label>
        ))}
        <button type="button" onClick={submit} disabled={busy || !campaignId || !startDate || channels.length === 0}
          className="ml-auto bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{busy ? 'Scheduling…' : 'Add to calendar'}</button>
      </div>
      {msg && <p role="status" className={`text-xs mt-3 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  )
}
