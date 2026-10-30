'use client'

import { useEffect, useState } from 'react'
import { LOCKABLE_FIELDS, LOCK_LABELS, buildDisclaimer, parseLockedColors, type LockableField, type OrgCompliance } from '@/lib/compliance/brand'

interface Loaded { profile: OrgCompliance | null; ownBrand: Record<LockableField, string> }
const box = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

export function ComplianceForm() {
  const [data, setData] = useState<Loaded | null>(null)
  const [disclaimer, setDisclaimer] = useState('')
  const [license, setLicense] = useState('')
  const [eho, setEho] = useState(false)
  const [agentLic, setAgentLic] = useState(false)
  const [locks, setLocks] = useState<LockableField[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/team/compliance').then(r => r.json()).then((d: Loaded & { error?: string }) => {
      if (d.error) { setMsg({ ok: false, text: d.error }); return }
      setData(d)
      const p = d.profile
      if (p) {
        setDisclaimer(p.requiredDisclaimer ?? ''); setLicense(p.brokerageLicense ?? ''); setEho(p.equalHousing); setAgentLic(p.showAgentLicense)
        setLocks(LOCKABLE_FIELDS.filter(k => p.locked[k]))
      }
    }).catch(() => setMsg({ ok: false, text: 'Could not load.' }))
  }, [])

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/team/compliance', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredDisclaimer: disclaimer, brokerageLicense: license, equalHousing: eho, showAgentLicense: agentLic, lockFields: locks }),
      })
      const body = await res.json().catch(() => ({}))
      setMsg(res.ok ? { ok: true, text: 'Saved. Applies to every agent immediately.' } : { ok: false, text: body.error || 'Could not save.' })
    } catch { setMsg({ ok: false, text: 'Network error.' }) } finally { setBusy(false) }
  }

  if (!data) return <div className="text-sm text-slate-400">{msg ? msg.text : 'Loading…'}</div>

  const preview = buildDisclaimer('(agent’s own disclaimer, if any)', { requiredDisclaimer: disclaimer || null, brokerageLicense: license || null, equalHousing: eho, showAgentLicense: agentLic, locked: {} }, agentLic ? '123456' : null)

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-display font-semibold text-slate-900">Required disclaimer</h2>
        <textarea className={box} rows={3} maxLength={600} value={disclaimer} onChange={e => setDisclaimer(e.target.value)} placeholder="e.g. Reed Realty Group is a licensed real estate broker. Information deemed reliable but not guaranteed." />
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="c-lic">Brokerage license number</label>
          <input id="c-lic" className={box} maxLength={60} value={license} onChange={e => setLicense(e.target.value)} placeholder="Optional" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={eho} onChange={e => setEho(e.target.checked)} /> Always add &quot;Equal Housing Opportunity.&quot;</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={agentLic} onChange={e => setAgentLic(e.target.checked)} /> Add each agent&apos;s own license number (from their Brand Kit page)</label>
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3"><span className="font-semibold">Preview of what appears on every piece:</span><br />{preview || 'Nothing yet.'}</div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h2 className="font-display font-semibold text-slate-900">Locked brand fields</h2>
        <p className="text-sm text-slate-500">Locked fields use <strong>your</strong> Brand Kit value and cannot be changed by agents. Re-save here after you edit your own Brand Kit.</p>
        {LOCKABLE_FIELDS.map(k => {
          const v = data.ownBrand[k]
          const isImg = k === 'brokerageLogo' || k === 'logoUrl'
          const extras = k === 'extraColors' && v ? (parseLockedColors(v) ?? []) : []
          return (
            <label key={k} className="flex items-center gap-3 text-sm text-slate-700 border border-slate-100 rounded-xl px-4 py-3">
              <input type="checkbox" disabled={!v} checked={locks.includes(k)} onChange={e => setLocks(e.target.checked ? [...locks, k] : locks.filter(x => x !== k))} />
              <span className="font-medium w-36">{LOCK_LABELS[k]}</span>
              <span className="text-slate-500 truncate">{!v ? 'Not set in your Brand Kit' : isImg ? 'Your uploaded image' : k === 'extraColors' ? `${extras.length} color${extras.length === 1 ? '' : 's'}` : v}</span>
              {extras.length > 0 && <span className="flex gap-1">{extras.map((c, i) => <span key={i} title={`${c.name}: ${c.value}`} className="w-5 h-5 rounded border border-slate-200" style={{ background: c.value }} />)}</span>}
              {v && (k === 'primaryColor' || k === 'accentColor') && <span className="w-5 h-5 rounded border border-slate-200" style={{ background: v }} />}
            </label>
          )
        })}
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-60">{busy ? 'Saving…' : 'Save compliance profile'}</button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}
