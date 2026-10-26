'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import { applyCompliance, type OrgCompliance } from '@/lib/compliance/brand'
import { brandWarnings, type BrandWarning } from '@/lib/compliance/warnings'

interface Finding {
  ruleId: string; category: string; severity: 'high' | 'medium' | 'low'; match: string; message: string
  after: string | null; section: string; context: string
}

const SEV: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-800', low: 'bg-slate-100 text-slate-600' }

/** Brand-completeness warnings + Fair Housing scan with one-click rewrites for one campaign. */
export function CompliancePanel({ campaignId, showBrand, onFixed }: { campaignId: string; showBrand: boolean; onFixed: () => void }) {
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [warnings, setWarnings] = useState<BrandWarning[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const scan = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/compliance`)
      if (res.ok) setFindings((await res.json()).findings)
    } catch { /* panel is advisory; stay quiet */ }
  }, [campaignId])

  useEffect(() => { scan() }, [scan])
  useEffect(() => {
    if (!showBrand) return
    fetch('/api/brand-kit').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return
      const org = (d.compliance ?? null) as OrgCompliance | null
      const eff = applyCompliance(d.brandKit, org, d.licenseNumber)
      setWarnings(brandWarnings(eff, { licenseNumber: d.licenseNumber }))
    }).catch(() => {})
  }, [showBrand])

  async function rewrite(ruleIds?: string[]) {
    setBusy(ruleIds?.[0] ?? 'all'); setMsg('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/compliance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ruleIds ? { ruleIds } : {}),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(body.error || 'Could not apply rewrites.'); return }
      setMsg(`Rewrote ${body.changes} phrase${body.changes === 1 ? '' : 's'}.`)
      await scan(); onFixed()
    } catch { setMsg('Network error.') } finally { setBusy(null) }
  }

  const required = warnings.filter(w => w.level === 'required')
  const rewritable = (findings ?? []).filter(f => f.after !== null)
  // one row per rule, so "Rewrite all" is predictable
  const byRule = new Map<string, Finding & { count: number }>()
  for (const f of findings ?? []) {
    const e = byRule.get(f.ruleId)
    if (e) e.count++; else byRule.set(f.ruleId, { ...f, count: 1 })
  }

  return (
    <div className="space-y-3">
      {required.length > 0 && (
        <div role="status" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          <strong>Your brand kit is missing: </strong>{required.map(w => w.message.replace(/ is missing$| missing$/, '').replace(/^No /, '').toLowerCase()).join(', ')}.{' '}
          <Link href="/dashboard/brand" className="font-semibold underline">Complete it</Link> so flyers and graphics carry the details your state may require.
        </div>
      )}

      {findings === null ? null : byRule.size === 0 ? (
        <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="w-4 h-4 text-green-600" /> Fair Housing check: no flagged phrases found. (A keyword scan — still review your copy.)</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 font-display font-semibold text-slate-900 text-sm"><ShieldAlert className="w-4 h-4 text-amber-600" /> Fair Housing check — {findings.length} phrase{findings.length === 1 ? '' : 's'} to review</div>
            {rewritable.length > 0 && (
              <button type="button" disabled={!!busy} onClick={() => rewrite()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg disabled:opacity-60">
                {busy === 'all' && <Loader2 className="w-3 h-3 animate-spin" />} Rewrite all safe fixes ({rewritable.length})
              </button>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {[...byRule.values()].map(f => (
              <li key={f.ruleId} className="px-5 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 mr-2 ${SEV[f.severity]}`}>{f.severity}</span>
                    <span className="font-semibold text-slate-900">&ldquo;{f.match}&rdquo;</span>
                    {f.count > 1 && <span className="text-xs text-slate-400"> ×{f.count}</span>}
                    <span className="text-xs text-slate-400"> · {f.category} · in {f.section}</span>
                    <p className="text-xs text-slate-600 mt-1">{f.message}</p>
                    <p className="text-xs text-slate-400 mt-1 italic truncate">{f.context}</p>
                  </div>
                  {f.after !== null
                    ? <button type="button" disabled={!!busy} onClick={() => rewrite([f.ruleId])} className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-200 rounded-lg px-2.5 py-1.5 disabled:opacity-60">
                        {busy === f.ruleId ? '…' : <>Rewrite to &ldquo;{f.after}&rdquo;</>}
                      </button>
                    : <span className="flex-shrink-0 text-xs text-slate-400">Edit by hand</span>}
                </div>
              </li>
            ))}
          </ul>
          <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">Keyword-based safety net, not legal advice and not exhaustive. You remain responsible for your marketing.</p>
        </div>
      )}
      {msg && <div role="status" className="text-xs text-slate-600">{msg}</div>}
    </div>
  )
}
