'use client'

import { useState, type CSSProperties } from 'react'
import { GROUP_LABEL, GROUPS, type ApprovalItem, type Decision } from '@/lib/approval/items'

type Answers = Record<string, { decision: Decision | null; comment: string }>

export function ApprovalForm({ token, items, initial, priorName, accent, submitted }: {
  token: string; items: ApprovalItem[]; initial: Record<string, { decision: Decision; comment: string }>; priorName: string; accent: string; submitted: boolean
}) {
  const [answers, setAnswers] = useState<Answers>(() => Object.fromEntries(items.map(i => [i.key, { decision: initial[i.key]?.decision ?? null, comment: initial[i.key]?.comment ?? '' }])))
  const [name, setName] = useState(priorName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(submitted)
  const [justSent, setJustSent] = useState(false)

  const set = (key: string, patch: Partial<Answers[string]>) => { setAnswers(a => ({ ...a, [key]: { ...a[key], ...patch } })); setJustSent(false) }
  const remaining = items.filter(i => !answers[i.key].decision).length
  const approveAll = () => setAnswers(a => Object.fromEntries(items.map(i => [i.key, a[i.key].decision === 'changes' ? a[i.key] : { decision: 'approved' as const, comment: '' }])))

  async function submit() {
    setError('')
    if (name.trim().length < 2) return setError('Please type your full name.')
    if (remaining > 0) return setError(`Please answer the ${remaining} item${remaining === 1 ? '' : 's'} that ${remaining === 1 ? 'is' : 'are'} still unanswered.`)
    const missing = items.find(i => answers[i.key].decision === 'changes' && !answers[i.key].comment.trim())
    if (missing) return setError(`Please say what to change for “${missing.label}”.`)
    setBusy(true)
    try {
      const res = await fetch(`/api/a/${token}/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedName: name.trim(), responses: items.map(i => ({ key: i.key, decision: answers[i.key].decision, comment: answers[i.key].decision === 'changes' ? answers[i.key].comment : undefined })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not send your answers.')
      setDone(true); setJustSent(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your answers.') } finally { setBusy(false) }
  }

  const btn = (active: boolean, color: string): CSSProperties => ({
    padding: '9px 16px', borderRadius: 10, border: `2px solid ${active ? color : '#e2e8f0'}`, background: active ? color : 'white', color: active ? 'white' : '#334155', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <div>
      {justSent && <div role="status" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>Thank you. Your answers were sent to your agent. You can change them below and send again.</div>}
      {done && !justSent && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>Your earlier answers are shown. You can change them and send again.</div>}
      <button type="button" onClick={approveAll} style={{ ...btn(false, accent), marginBottom: 16, fontSize: 13 }}>Approve everything that has no change request</button>

      {GROUPS.map(g => {
        const list = items.filter(i => i.group === g)
        if (!list.length) return null
        return (
          <section key={g} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#64748b', margin: '0 0 10px' }}>{GROUP_LABEL[g]}</h2>
            {list.map(i => {
              const a = answers[i.key]
              return (
                <article key={i.key} style={{ border: `1px solid ${a.decision === 'changes' ? '#fbbf24' : a.decision === 'approved' ? '#86efac' : '#e2e8f0'}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>{i.label}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{i.text}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }} role="group" aria-label={`Decision for ${i.label}`}>
                    <button type="button" aria-pressed={a.decision === 'approved'} onClick={() => set(i.key, { decision: 'approved' })} style={btn(a.decision === 'approved', '#16a34a')}>Approve</button>
                    <button type="button" aria-pressed={a.decision === 'changes'} onClick={() => set(i.key, { decision: 'changes' })} style={btn(a.decision === 'changes', '#d97706')}>Request changes</button>
                  </div>
                  {a.decision === 'changes' && (
                    <textarea value={a.comment} onChange={e => set(i.key, { comment: e.target.value })} maxLength={1000} rows={3} aria-label={`What should change in ${i.label}`} placeholder="What would you like changed?"
                      style={{ width: '100%', marginTop: 10, border: '1px solid #cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  )}
                </article>
              )
            })}
          </section>
        )
      })}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#f8fafc' }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }} htmlFor="signed-name">Your full name</label>
        <input id="signed-name" value={name} onChange={e => { setName(e.target.value); setJustSent(false) }} maxLength={80} autoComplete="name"
          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 14, margin: '10px 0 0' }}>{error}</p>}
        <button type="button" onClick={submit} disabled={busy} style={{ marginTop: 14, background: accent, color: 'white', border: 'none', borderRadius: 10, padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}>
          {busy ? 'Sending…' : done ? 'Send updated answers' : 'Send my answers'}
        </button>
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 12 }}>{remaining > 0 ? `${remaining} unanswered` : 'All answered'}</span>
      </div>
    </div>
  )
}
