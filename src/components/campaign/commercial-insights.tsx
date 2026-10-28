'use client'

import { useMemo, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import { financingScenario, investmentSnapshot, offeringReadiness } from '@/lib/commercial/metrics'
import type { CommercialDetails } from '@/lib/commercial/types'

interface Props {
  details: CommercialDetails
  price: number | null; sqft: number | null; yearBuilt: number | null
  photoCount: number; descriptionLength: number
}
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const num = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm bg-white'

/** Commercial-plan insights. Pure math on the broker's own numbers: nothing is fetched, estimated or sent anywhere. */
export function CommercialInsights({ details, price, sqft, yearBuilt, photoCount, descriptionLength }: Props) {
  const [ltv, setLtv] = useState('65'); const [rate, setRate] = useState('7'); const [amort, setAmort] = useState('25')

  const rows = useMemo(() => investmentSnapshot({ price, sqft, units: details.units, lotAcres: details.lotAcres, noi: details.noi, capRatePct: details.capRatePct }), [price, sqft, details])
  const ready = useMemo(() => offeringReadiness({ details, price, sqft, yearBuilt, photoCount, descriptionLength }), [details, price, sqft, yearBuilt, photoCount, descriptionLength])
  const fin = useMemo(() => (price && details.noi ? financingScenario({ price, noi: details.noi, ltvPct: Number(ltv), ratePct: Number(rate), amortYears: Number(amort) }) : null), [price, details.noi, ltv, rate, amort])
  const tone = ready.score >= 80 ? 'text-green-700 bg-green-50 border-green-200' : ready.score >= 55 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-display font-semibold text-slate-900">Investment Snapshot</h2>
          <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">From your numbers</span>
        </div>
        {rows.length === 0 ? <p className="text-sm text-slate-500">Add price, size, NOI or cap rate to the property to see price per SF, price per unit and implied cap rate.</p> : (
          <dl className="divide-y divide-slate-100">
            {rows.map(r => (
              <div key={r.label} className="py-2 flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-600">{r.label}</dt><dd className="text-sm font-semibold text-slate-900 text-right">{r.value}</dd>
                {r.note && <p className="basis-full text-xs text-amber-700">{r.note}</p>}
              </div>
            ))}
          </dl>
        )}
        {price && details.noi ? (
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Financing scenario <span className="font-normal text-slate-500">(illustrative, your assumptions)</span></h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-slate-600">LTV %<input className={num} inputMode="decimal" value={ltv} onChange={e => setLtv(e.target.value)} /></label>
              <label className="text-xs text-slate-600">Rate %<input className={num} inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} /></label>
              <label className="text-xs text-slate-600">Amort. yrs<input className={num} inputMode="numeric" value={amort} onChange={e => setAmort(e.target.value)} /></label>
            </div>
            {fin ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-600">Loan</dt><dd className="font-semibold text-right">{usd(fin.loan)}</dd>
                <dt className="text-slate-600">Equity required</dt><dd className="font-semibold text-right">{usd(fin.equity)}</dd>
                <dt className="text-slate-600">Annual debt service</dt><dd className="font-semibold text-right">{usd(fin.annualDebtService)}</dd>
                <dt className="text-slate-600">DSCR</dt><dd className="font-semibold text-right">{fin.dscr.toFixed(2)}x</dd>
                <dt className="text-slate-600">Debt yield</dt><dd className="font-semibold text-right">{fin.debtYieldPct.toFixed(1)}%</dd>
                <dt className="text-slate-600">Cash-on-cash</dt><dd className="font-semibold text-right">{fin.cashOnCashPct.toFixed(1)}%</dd>
              </dl>
            ) : <p className="text-xs text-red-700">Enter LTV 1-100, rate 0-30 and amortization 1-40 years.</p>}
            <p className="text-[11px] text-slate-500">For your own conversations with buyers. Not a loan quote and not published anywhere by ListOps. NOI is owner-provided and subject to verification.</p>
          </div>
        ) : null}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-display font-semibold text-slate-900">Offering Readiness</h2>
          <span className={`text-sm font-bold border rounded-full px-3 py-0.5 ${tone}`}>{ready.score}/100</span>
        </div>
        <p className="text-sm text-slate-500">What a buyer or broker will ask for. Add the missing items, then regenerate the offering copy.</p>
        <ul className="space-y-2">
          {ready.items.map(it => (
            <li key={it.label} className="flex gap-2 text-sm">
              {it.ok ? <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" aria-label="Done" /> : <Circle className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" aria-label="Missing" />}
              <span className="min-w-0"><span className={it.ok ? 'text-slate-700' : 'font-semibold text-slate-900'}>{it.label}</span>{!it.ok && <span className="block text-xs text-slate-500">{it.tip}</span>}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
