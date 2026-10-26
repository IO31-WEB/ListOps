'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Lock, RefreshCw } from 'lucide-react'
import type { CommercialPackage } from '@/lib/commercial/output'

interface Post { week: number; theme?: string; copy?: string; post?: string; hashtags?: string[] }
export interface CommercialCampaignView {
  id: string; status: string
  commercial: CommercialPackage | null
  facebookPosts?: Post[]; linkedin?: Post[]
  micrositeSlug?: string; micrositePublished?: boolean
  micrositeCopy?: Record<string, string> | null
}

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) } catch { /* clipboard blocked */ } }}
      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1 bg-white">
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{done ? 'Copied' : label}
    </button>
  )
}

function Card({ title, badge, children, actions, regen }: { title: string; badge?: string; children: React.ReactNode; actions?: React.ReactNode; regen?: { run: () => void; busy: boolean; disabled: boolean } }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-slate-900">{title}</h2>
        {badge && <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{badge}</span>}
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {regen && (
            <button type="button" onClick={regen.run} disabled={regen.disabled}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1 bg-white disabled:opacity-50"
              aria-label={`Regenerate ${title}`}>
              <RefreshCw className={`w-3.5 h-3.5 ${regen.busy ? 'animate-spin' : ''}`} />{regen.busy ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}

const Block = ({ label, text }: { label: string; text: string }) => text ? (
  <div>
    <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span><CopyBtn text={text} /></div>
    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{text}</p>
  </div>
) : null

export function CommercialSections({ c, canOm, canSend, publishing, onToggleMicrosite, onRegenerate, regenerating, canMicrosite }: {
  c: CommercialCampaignView; canOm: boolean; canSend: boolean; publishing: boolean; onToggleMicrosite: () => void
  onRegenerate: (section: string) => void; regenerating: string | null; canMicrosite: boolean
}) {
  const regen = (key: string) => ({ run: () => onRegenerate(key), busy: regenerating === key, disabled: regenerating !== null })
  const pkg = c.commercial
  if (!pkg) {
    return <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">{c.status === 'complete' ? 'This campaign has no commercial package. Generate a new commercial campaign.' : 'The package is still generating or did not finish.'}</div>
  }
  const offering = [pkg.teaser, '', pkg.onePager.summary, '', ...pkg.onePager.highlights.map(h => `• ${h}`), '', pkg.onePager.locationOverview, pkg.onePager.financialSummary].filter(x => x !== undefined).join('\n')

  return (
    <div className="space-y-4">
      <Card title="Offering copy" badge="Teaser · One-pager · Narrative" regen={regen('offering')} actions={<CopyBtn text={offering} label="Copy one-pager" />}>
        <Block label="Headline" text={pkg.headline} />
        {pkg.headlineVariations.length > 0 && <Block label="Alternative headlines" text={pkg.headlineVariations.join('\n')} />}
        <Block label="Teaser (email-ready)" text={pkg.teaser} />
        <Block label="One-pager summary" text={pkg.onePager.summary} />
        {pkg.onePager.highlights.length > 0 && <Block label="Highlights" text={pkg.onePager.highlights.map(h => `• ${h}`).join('\n')} />}
        <Block label="Location" text={pkg.onePager.locationOverview} />
        <Block label="Financial summary (owner-provided figures only)" text={pkg.onePager.financialSummary} />
        <Block label="Long narrative" text={pkg.narrative} />
      </Card>

      {pkg.omSections ? (
        <Card title="Offering memorandum copy" badge="Sectioned · edit before sending" regen={regen('om')} actions={<CopyBtn text={pkg.omSections.map(s => `${s.title}\n\n${s.body}`).join('\n\n')} label="Copy all" />}>
          {pkg.omSections.map(s => <Block key={s.title} label={s.title} text={s.body} />)}
        </Card>
      ) : canOm ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 flex items-center gap-3 text-sm text-slate-500">
          No OM sections on this campaign yet.
          <button type="button" onClick={() => onRegenerate('om')} disabled={regenerating !== null} className="ml-auto text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 disabled:opacity-50">{regenerating === 'om' ? 'Generating…' : 'Generate OM sections'}</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 flex items-center gap-3 text-sm text-slate-500">
          <Lock className="w-4 h-4 text-slate-300" /> Sectioned OM-style copy is included on Pro and above. <Link href="/dashboard/billing" className="underline font-semibold text-slate-700">See plans</Link>
        </div>
      )}

      <Card title="LinkedIn" badge="6 weeks" regen={regen('social')} actions={<Link href={`/dashboard/social?campaign=${c.id}`} className="text-xs font-semibold underline text-slate-700">Schedule on calendar</Link>}>
        {(c.linkedin ?? []).map(p => <Block key={p.week} label={`Week ${p.week}${p.theme ? ` · ${p.theme}` : ''}`} text={[p.post, (p.hashtags ?? []).map(h => `#${h}`).join(' ')].filter(Boolean).join('\n\n')} />)}
      </Card>
      <Card title="Facebook" badge="6 weeks" regen={regen('social')}>
        {(c.facebookPosts ?? []).map(p => <Block key={p.week} label={`Week ${p.week}${p.theme ? ` · ${p.theme}` : ''}`} text={[p.copy, (p.hashtags ?? []).map(h => `#${h}`).join(' ')].filter(Boolean).join('\n\n')} />)}
      </Card>

      <Card title="Broker / investor email sequence" badge={`${pkg.emailSequence.length} touches`} regen={regen('emails')} actions={<CopyBtn text={pkg.emailSequence.map(e => `Day ${e.sendDay}: ${e.subject}\n\n${e.body}`).join('\n\n---\n\n')} label="Copy all" />}>
        {pkg.emailSequence.map(e => <Block key={`${e.sendDay}-${e.subject}`} label={`Day ${e.sendDay} · ${e.purpose || 'Email'} · ${e.subject}`} text={e.body} />)}
        <OutreachPanel campaignId={c.id} sequence={pkg.emailSequence} allowed={canSend} />
      </Card>

      <Card title="One-sheet / flyer" badge="Print" regen={regen('print')} actions={<a href={`/flyer/${c.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold underline text-slate-700"><ExternalLink className="w-3.5 h-3.5" />Open flyer</a>}>
        <Block label="Headline" text={pkg.print.oneSheetHeadline} />
        <Block label="Subhead" text={pkg.print.oneSheetSubhead} />
        <Block label="Body" text={pkg.print.oneSheetBody} />
        {pkg.print.callouts.length > 0 && <Block label="Callouts" text={pkg.print.callouts.map(k => `${k.label}: ${k.value}`).join('\n')} />}
        <Block label="Call to action" text={pkg.print.callToAction} />
        <p className="text-xs text-slate-400">The flyer page prints these facts with your brand kit, a trackable QR code and the disclaimer. Print or save it as PDF from there.</p>
      </Card>

      <Card title="Teaser page" badge="Microsite" regen={canMicrosite ? regen('microsite') : undefined}
        actions={<>
          {c.micrositeSlug && c.micrositePublished && <a href={`/l/${c.micrositeSlug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline text-slate-700">View page</a>}
          <button type="button" onClick={onToggleMicrosite} disabled={publishing} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-50">{publishing ? 'Working…' : c.micrositePublished ? 'Unpublish' : 'Publish'}</button>
        </>}>
        <p className="text-sm text-slate-600">A public teaser page with property facts, your photos, the narrative and a Request Info form (Starter and above). Publish it to get the link used in the posts and emails above.</p>
        {c.micrositeCopy?.heroHeadline && <Block label="Page headline" text={c.micrositeCopy.heroHeadline} />}
      </Card>
    </div>
  )
}

function OutreachPanel({ campaignId, sequence, allowed }: { campaignId: string; sequence: CommercialPackage['emailSequence']; allowed: boolean }) {
  const [raw, setRaw] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (!allowed) return <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">Sending this sequence from ListOps is available on the Commercial plan. You can always copy the emails into your own email tool.</p>

  const prospects = raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [email, ...rest] = l.split(/[,;\t]/)
    return { email: email.trim(), name: rest.join(' ').trim() || undefined }
  })
  async function send() {
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/outreach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospects, sequence: sequence.map(e => ({ subject: e.subject, body: e.body, sendDay: e.sendDay })) }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send.')
      setMsg(data.message || 'Sent.'); setRaw(''); setOk(false)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not send.') } finally { setBusy(false) }
  }
  async function cancel() {
    if (!confirm('Cancel all follow-ups that have not been sent yet for this campaign?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/outreach`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? `Cancelled ${data.cancelled ?? 0} pending follow-up${data.cancelled === 1 ? '' : 's'}.` : data.error || 'Could not cancel.')
    } finally { setBusy(false) }
  }
  return (
    <div className="border-t border-slate-100 pt-4 space-y-3">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Send this sequence from ListOps</div>
      <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={4} placeholder={'One recipient per line: email, optional name\njane@brokerage.com, Jane Smith'}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" aria-label="Recipients" />
      <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-0.5" />
        I have a lawful basis to email these people (business contacts, prior inquiries or opt-in). Each email identifies me, includes our postal address and a one-click unsubscribe; unsubscribed addresses are skipped automatically. Max 100 recipients per send.</label>
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy || !ok || prospects.length === 0 || prospects.length > 100} onClick={send} className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{busy ? 'Working…' : `Send to ${prospects.length || 0}`}</button>
        <button type="button" disabled={busy} onClick={cancel} className="text-xs text-slate-500 underline">Cancel pending follow-ups</button>
      </div>
      {msg && <p role="status" className="text-xs text-slate-600">{msg}</p>}
    </div>
  )
}
