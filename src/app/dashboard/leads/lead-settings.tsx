'use client'

import { useEffect, useState } from 'react'

interface Settings {
  notifyEmail: string; smsEnabled: boolean; smsPhone: string; webhookUrl: string; webhookSecret: string
  capabilities: { export: boolean; webhook: boolean; sms: boolean; smsConfigured: boolean }
}

const input = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400'

export function LeadSettingsPanel() {
  const [s, setS] = useState<Settings | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    fetch('/api/leads/settings').then(r => (r.ok ? r.json() : null)).then(setS).catch(() => setMsg({ ok: false, text: 'Could not load settings.' }))
  }, [])

  async function save(extra: Record<string, unknown> = {}) {
    if (!s) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/leads/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEmail: s.notifyEmail, smsEnabled: s.smsEnabled, smsPhone: s.smsPhone, webhookUrl: s.webhookUrl, ...extra }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ ok: false, text: body.error || 'Could not save.' }); return }
      setS(body); setMsg({ ok: true, text: 'Saved.' })
    } catch { setMsg({ ok: false, text: 'Network error.' }) } finally { setBusy(false) }
  }

  async function test() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/leads/settings/test', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      setMsg(res.ok && body.ok ? { ok: true, text: `Test delivered (HTTP ${body.status}).` } : { ok: false, text: body.reason || body.error || 'Test failed.' })
    } catch { setMsg({ ok: false, text: 'Network error.' }) } finally { setBusy(false) }
  }

  if (!s) return <div className="text-sm text-slate-400">Loading settings…</div>
  const c = s.capabilities

  return (
    <div className="grid gap-5 max-w-2xl">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="ls-email">Send lead alerts to</label>
        <input id="ls-email" type="email" className={input} value={s.notifyEmail} placeholder="Defaults to your brand-kit email" onChange={e => setS({ ...s, notifyEmail: e.target.value })} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="ls-sms">SMS alert to your mobile {!c.sms && <span className="text-amber-600">(Pro plan)</span>}</label>
        <input id="ls-sms" type="tel" className={input} disabled={!c.sms || !c.smsConfigured} value={s.smsPhone} placeholder="+1 555 123 4567" onChange={e => setS({ ...s, smsPhone: e.target.value })} />
        <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
          <input type="checkbox" disabled={!c.sms || !c.smsConfigured} checked={s.smsEnabled} onChange={e => setS({ ...s, smsEnabled: e.target.checked })} /> Text me when a lead comes in
        </label>
        {c.sms && !c.smsConfigured && <p className="text-xs text-slate-500 mt-1">SMS alerts are not switched on for this server yet.</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="ls-hook">Webhook URL (Zapier, Make, your CRM) {!c.webhook && <span className="text-amber-600">(Pro plan)</span>}</label>
        <input id="ls-hook" type="url" className={input} disabled={!c.webhook} value={s.webhookUrl} placeholder="https://hooks.zapier.com/hooks/catch/…" onChange={e => setS({ ...s, webhookUrl: e.target.value })} />
        {c.webhook && s.webhookSecret && (
          <div className="mt-2 text-xs text-slate-500">
            Signing secret:{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded">{showSecret ? s.webhookSecret : '••••••••••••••••'}</code>{' '}
            <button type="button" className="text-amber-600 font-medium" onClick={() => setShowSecret(v => !v)}>{showSecret ? 'Hide' : 'Show'}</button>{' · '}
            <button type="button" className="text-amber-600 font-medium" disabled={busy} onClick={() => { if (confirm('Rotate the signing secret? Update your receiver afterwards.')) save({ rotateSecret: true }) }}>Rotate</button>
            <p className="mt-1">Each POST carries <code>X-ListOps-Signature: sha256=HMAC(secret, timestamp + "." + body)</code> and <code>X-ListOps-Timestamp</code>. Zapier can ignore the signature.</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" disabled={busy} onClick={() => save()} className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-60">Save settings</button>
        {c.webhook && s.webhookUrl && <button type="button" disabled={busy} onClick={test} className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60">Send test event</button>}
        {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}
