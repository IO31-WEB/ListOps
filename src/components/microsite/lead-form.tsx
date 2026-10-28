'use client'

import { useEffect, useRef, useState } from 'react'

type Kind = 'showing' | 'info'

interface Props {
  slug: string
  address: string
  agentName: string
  consent: string
  primary: string
  accent: string
  /** Broker/investor wording for commercial offerings. */
  commercial?: boolean
}

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 10,
  fontSize: 15, fontFamily: 'Arial, sans-serif', background: 'white', color: '#0f172a',
}
const label: React.CSSProperties = { fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }

export function LeadForm({ slug, address, agentName, consent, primary, accent, commercial }: Props) {
  const [kind, setKind] = useState<Kind>(commercial ? 'info' : 'showing')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const shownAt = useRef(0)
  useEffect(() => { shownAt.current = Date.now() }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'sending') return
    const f = new FormData(e.currentTarget)
    const q = new URLSearchParams(window.location.search)
    const str = (k: string) => String(f.get(k) ?? '').trim() || undefined
    setStatus('sending'); setError('')
    try {
      const res = await fetch(`/api/l/${encodeURIComponent(slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          name: str('name'), email: str('email'), phone: str('phone'), message: str('message'),
          preferredDate: kind === 'showing' ? str('preferredDate') : undefined,
          preferredTime: kind === 'showing' ? str('preferredTime') : undefined,
          consent: f.get('consent') === 'on',
          website: str('website'),
          elapsedMs: Date.now() - shownAt.current,
          source: q.get('utm_source') ?? q.get('src') ?? undefined,
          medium: q.get('utm_medium') ?? undefined,
          campaignTag: q.get('utm_campaign') ?? undefined,
          referrer: document.referrer || undefined,
        }),
      })
      if (res.ok) { setStatus('done'); return }
      const body = await res.json().catch(() => ({}))
      setError(res.status === 400 ? 'Please check your name, email and consent box and try again.' : body.error || 'Something went wrong. Please try again.')
      setStatus('error')
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div role="status" style={{ background: 'white', border: `2px solid ${primary}`, borderRadius: 16, padding: '32px 24px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: primary, marginBottom: 8 }}>Thank you!</div>
        <div style={{ fontSize: 15, color: '#475569' }}>{agentName || (commercial ? 'The listing broker' : 'The listing agent')} received your request and will be in touch shortly.</div>
      </div>
    )
  }

  const tab = (k: Kind, text: string) => (
    <button type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
      style={{ flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, fontWeight: 700,
        background: kind === k ? primary : '#f1f5f9', color: kind === k ? 'white' : '#475569' }}>
      {text}
    </button>
  )
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={onSubmit} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', textAlign: 'left' }}>
      <div style={{ display: 'flex' }}>{commercial ? <>{tab('info', 'Request Information')}{tab('showing', 'Schedule a Tour')}</> : <>{tab('showing', 'Schedule a Showing')}{tab('info', 'Request More Info')}</>}</div>
      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#64748b' }}>
          {kind === 'showing' ? `Pick a time to tour ${address}.` : commercial ? `Request the offering details for ${address} from ${agentName || 'the broker'}.` : `Ask ${agentName || 'the agent'} anything about ${address}.`}
        </div>
        <div><label style={label} htmlFor="lf-name">Your name</label><input id="lf-name" name="name" required maxLength={100} autoComplete="name" style={field} /></div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div><label style={label} htmlFor="lf-email">Email</label><input id="lf-email" name="email" type="email" required maxLength={200} autoComplete="email" style={field} /></div>
          <div><label style={label} htmlFor="lf-phone">Phone (optional)</label><input id="lf-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" style={field} /></div>
        </div>
        {kind === 'showing' && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div><label style={label} htmlFor="lf-date">Preferred date</label><input id="lf-date" name="preferredDate" type="date" min={today} style={field} /></div>
            <div><label style={label} htmlFor="lf-time">Preferred time</label>
              <select id="lf-time" name="preferredTime" defaultValue="anytime" style={field}>
                <option value="anytime">Anytime</option><option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option><option value="evening">Evening</option>
              </select></div>
          </div>
        )}
        <div><label style={label} htmlFor="lf-msg">Message (optional)</label><textarea id="lf-msg" name="message" rows={3} maxLength={2000} style={{ ...field, resize: 'vertical' }} /></div>

        {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
          <input name="consent" type="checkbox" required style={{ marginTop: 3 }} /> <span>{consent}</span>
        </label>

        {status === 'error' && <div role="alert" style={{ color: '#b91c1c', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>{error}</div>}
        <button type="submit" disabled={status === 'sending'}
          style={{ background: primary, color: 'white', border: 'none', borderBottom: `3px solid ${accent}`, padding: '15px 24px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Arial, sans-serif', opacity: status === 'sending' ? 0.7 : 1 }}>
          {status === 'sending' ? 'Sending…' : kind === 'showing' ? (commercial ? 'Request Tour' : 'Request Showing') : commercial ? 'Request Information' : 'Send Request'}
        </button>
      </div>
    </form>
  )
}
