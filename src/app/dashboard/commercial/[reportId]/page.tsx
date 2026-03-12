'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Printer, RefreshCw, Car, DollarSign, Home, Users, Store,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Building2, MapPin,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CostarReport {
  id: string
  propertyAddress: string
  propertyCity: string | null
  propertyState: string | null
  propertyZip: string | null
  rawPdfFilename: string | null
  source: string
  demographics: {
    threeMile: {
      population2024: number
      populationGrowth5yr: number
      medianAge: number
      medianHouseholdIncome: number
      avgHouseholdIncome: number
      medianHomeValue: number
      bachelorsPlusPct: number
      age65PlusPct: number
    } | null
  } | null
  trafficCounts: Array<{
    street: string
    avgDailyVolume: number
    countYear: number
    distanceMiles: number
  }> | null
  consumerSpend: {
    threeMile: { totalSpecified: number; foodAlcohol: number; household: number } | null
  } | null
  createdAt: string
}

interface PropertyGrade {
  id: string
  overallGrade: string
  overallScore: string
  trafficScore: string
  trafficGrade: string
  consumerSpendScore: string
  consumerSpendGrade: string
  householdIncomeScore: string
  householdIncomeGrade: string
  demographicsScore: string
  demographicsGrade: string
  anchorTenantScore: string
  anchorTenantGrade: string
  anchorTenants: Array<{
    name: string
    distanceMiles: number
    category: string
    salesGrade: string | null
    impact: 'positive' | 'neutral' | 'negative'
  }> | null
  aiSummary: string | null
  aiStrengths: string[] | null
  aiRisks: string[] | null
  aiRecommendation: string | null
  weightsSnapshot: Record<string, number>
  generatedAt: string
}

const GRADE_BG: Record<string, string> = {
  'A+': 'bg-emerald-500', 'A': 'bg-emerald-500', 'A-': 'bg-emerald-400',
  'B+': 'bg-blue-500',    'B': 'bg-blue-500',    'B-': 'bg-blue-400',
  'C+': 'bg-amber-500',   'C': 'bg-amber-500',   'C-': 'bg-amber-400',
  'D+': 'bg-orange-500',  'D': 'bg-orange-500',  'D-': 'bg-orange-400',
  'F':  'bg-red-500',
}

const GRADE_HEX: Record<string, string> = {
  'N/A': '#94a3b8',
  'A+': '#10b981', 'A': '#10b981', 'A-': '#34d399',
  'B+': '#3b82f6', 'B': '#3b82f6', 'B-': '#60a5fa',
  'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#fbbf24',
  'D+': '#f97316', 'D': '#f97316', 'D-': '#fb923c',
  'F':  '#ef4444',
}

function ScoreBar({ score, grade }: { score: number; grade: string }) {
  const pct = Math.round(score)
  const bg = GRADE_BG[grade] ?? 'bg-slate-400'
  const hex = GRADE_HEX[grade] ?? '#94a3b8'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden print:border print:border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bg}`}
          style={{ width: `${pct}%`, backgroundColor: hex }}
        />
      </div>
      <span className="text-sm font-bold text-slate-700 w-8 text-right">{pct}</span>
    </div>
  )
}

function GradeBadge({ grade, size = 'md' }: { grade: string; size?: 'sm' | 'md' | 'lg' }) {
  const hex = GRADE_HEX[grade] ?? '#94a3b8'
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-lg', lg: 'w-20 h-20 text-3xl' }
  return (
    <div
      className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: hex }}
    >
      {grade}
    </div>
  )
}

const CATEGORY_ICONS = {
  traffic: Car, consumerSpend: DollarSign, householdIncome: Home,
  demographics: Users, anchorTenant: Store,
}
const CATEGORY_LABELS = {
  traffic: 'Daily Traffic', consumerSpend: 'Consumer Spend',
  householdIncome: 'Household Income', demographics: 'Demographics',
  anchorTenant: 'Anchor Tenants',
}
const CATEGORY_DESCRIPTIONS = {
  traffic: 'Average daily vehicle count on nearest arterial roads',
  consumerSpend: 'Total annual consumer spending in the 3-mile trade area',
  householdIncome: 'Median household income in the 3-mile trade area',
  demographics: 'Population size, growth rate, education, and age profile',
  anchorTenant: 'Big-box, grocery, and high-traffic retailers in proximity',
}

// Print styles injected as a <style> tag — Tailwind can't express all print rules
const PRINT_STYLES = `
@media print {
  @page {
    size: letter portrait;
    margin: 0.6in 0.65in;
  }

  /* Hide all dashboard chrome */
  nav, aside, header,
  [data-sidebar],
  .no-print { display: none !important; }

  /* Reset page background */
  body, html { background: white !important; }

  /* Make the content area full-width */
  main, [data-main-content] {
    margin: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  /* Ensure colors print — critical for grade bands */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  /* Avoid page breaks inside key sections */
  .print-no-break { page-break-inside: avoid; break-inside: avoid; }

  /* Push strengths/risks to their own row if they'd orphan */
  .print-break-before { page-break-before: auto; break-before: auto; }

  /* Score bars: border fallback for printers that strip backgrounds */
  .print-bar-track {
    border: 1px solid #e2e8f0;
  }
}
`

export default function GradeCardPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params)
  const [report, setReport] = useState<CostarReport | null>(null)
  const [grade, setGrade] = useState<PropertyGrade | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  async function fetchData() {
    try {
      const res = await fetch(`/api/commercial/reports?id=${reportId}`)
      if (!res.ok) throw new Error('Failed to load report')
      const data = await res.json()
      setReport(data.report)
      setGrade(data.grade)
    } catch {
      toast.error('Failed to load grade card')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [reportId])

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const res = await fetch('/api/commercial/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, regenerate: true }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Regeneration failed'); return }
      toast.success('Grade card regenerated')
      await fetchData()
    } catch {
      toast.error('Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleEnrich() {
    setEnriching(true)
    try {
      const res = await fetch('/api/commercial/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 501) {
          toast.error('Google Places API not configured — contact support')
        } else {
          toast.error(data.error ?? 'Enrichment failed')
        }
        return
      }
      const found = data.placesFound ?? 0
      toast.success(found > 0
        ? `Found ${found} nearby retailers — grade updated`
        : 'No retailers found nearby — grade updated without anchor data'
      )
      await fetchData()
    } catch {
      toast.error('Enrichment failed — please try again')
    } finally {
      setEnriching(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!report || !grade) {
    return (
      <div className="min-h-screen bg-[var(--cream)] p-8 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-slate-700 font-medium">Grade card not found</p>
        <Link href="/dashboard/commercial" className="text-amber-600 underline">← Back to reports</Link>
      </div>
    )
  }

  const overallScore = Number(grade.overallScore)
  const topTraffic = (report.trafficCounts ?? [])
    .sort((a, b) => b.avgDailyVolume - a.avgDailyVolume)
    .slice(0, 3)

  const categories: Array<keyof typeof CATEGORY_ICONS> = [
    'traffic', 'consumerSpend', 'householdIncome', 'demographics', 'anchorTenant',
  ]

  const headerHex = GRADE_HEX[grade.overallGrade] ?? '#94a3b8'

  return (
    <>
      {/* Inject print styles */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="min-h-screen bg-[var(--cream)] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Nav — hidden on print */}
          <div className="flex items-center justify-between no-print">
            <Link
              href="/dashboard/commercial"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Reports
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:border-slate-300 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </div>
          </div>

          {/* ── Grade Card Hero ── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm print-no-break">

            {/* Colored header band — inline style for print color fidelity */}
            <div className="p-6 text-white" style={{ backgroundColor: headerHex }}>
              <div className="flex items-start gap-5">
                <div className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center border-2 flex-shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)' }}>
                  <span className="text-4xl font-black leading-none">{grade.overallGrade}</span>
                  <span className="text-sm font-medium opacity-80 mt-0.5">{overallScore.toFixed(1)}/100</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <Building2 className="w-3.5 h-3.5" />
                    COMMERCIAL SITE ANALYSIS
                  </div>
                  <h1 className="text-xl font-bold leading-tight">{report.propertyAddress}</h1>
                  {(report.propertyCity || report.propertyState) && (
                    <p className="text-sm mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      <MapPin className="w-3.5 h-3.5" />
                      {[report.propertyCity, report.propertyState, report.propertyZip].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Graded {new Date(grade.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {report.rawPdfFilename ? ` · Source: ${report.rawPdfFilename}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            {grade.aiSummary && (
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                <p className="text-slate-700 text-sm leading-relaxed">{grade.aiSummary}</p>
                {grade.aiRecommendation && (
                  <p className="mt-2 text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block flex-shrink-0" />
                    {grade.aiRecommendation}
                  </p>
                )}
              </div>
            )}

            {/* Category scores */}
            <div className="p-6 space-y-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category Breakdown</h2>
              {categories.map((cat) => {
                const scoreKey = `${cat}Score` as keyof PropertyGrade
                const gradeKey = `${cat}Grade` as keyof PropertyGrade
                const Icon = CATEGORY_ICONS[cat]
                const score = Number(grade[scoreKey])
                const catGrade = grade[gradeKey] as string
                const catHex = GRADE_HEX[catGrade] ?? '#94a3b8'

                const isNoData = catGrade === 'N/A'
                return (
                  <div key={cat} className="space-y-1.5 print-no-break">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{CATEGORY_LABELS[cat]}</span>
                          <p className="text-xs text-slate-400 leading-none">{CATEGORY_DESCRIPTIONS[cat]}</p>
                        </div>
                      </div>
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                        style={{ backgroundColor: catHex }}
                      >
                        {isNoData ? '—' : catGrade}
                      </div>
                    </div>
                    {isNoData ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-slate-200" style={{ width: '100%' }} />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">N/A</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round(score)}%`, backgroundColor: catHex }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-700 w-8 text-right">{Math.round(score)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Strengths & Risks */}
          {(grade.aiStrengths?.length || grade.aiRisks?.length) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-no-break">
              {grade.aiStrengths?.length ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <h3 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Strengths
                  </h3>
                  <ul className="space-y-2">
                    {grade.aiStrengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                        <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {grade.aiRisks?.length ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
                  <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Risk Flags
                  </h3>
                  <ul className="space-y-2">
                    {grade.aiRisks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <TrendingDown className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {/* Traffic Detail */}
          {topTraffic.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 print-no-break">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-slate-500" /> Traffic Counts
              </h3>
              <div className="space-y-2">
                {topTraffic.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{t.street}</p>
                      <p className="text-xs text-slate-400">{t.distanceMiles} mi from subject · {t.countYear}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{t.avgDailyVolume.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">avg daily</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anchor Tenants */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 print-no-break">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Store className="w-4 h-4 text-slate-500" /> Nearby Anchors & Retailers
              </h3>
              <button
                onClick={handleEnrich}
                className="no-print flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                title="Re-enrich from Google Maps"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Retailer list */}
            {(grade.anchorTenants?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {grade.anchorTenants!.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: a.impact === 'positive' ? '#10b981' :
                          a.impact === 'negative' ? '#f87171' : '#cbd5e1'
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.category.replace('_', ' ')} · {a.distanceMiles} mi</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.salesGrade && (
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {a.salesGrade}
                        </span>
                      )}
                      {a.impact === 'positive' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      ) : a.impact === 'negative' ? (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      ) : (
                        <Minus className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Demographics Snapshot */}
          {report.demographics?.threeMile && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 print-no-break">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" /> 3-Mile Demographics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Population', value: report.demographics.threeMile.population2024.toLocaleString() },
                  { label: '5-yr Growth', value: `${report.demographics.threeMile.populationGrowth5yr.toFixed(1)}%` },
                  { label: 'Median Age', value: report.demographics.threeMile.medianAge.toFixed(1) },
                  { label: 'Median HH Income', value: `$${report.demographics.threeMile.medianHouseholdIncome.toLocaleString()}` },
                  { label: 'Avg HH Income', value: `$${report.demographics.threeMile.avgHouseholdIncome.toLocaleString()}` },
                  { label: 'Median Home Value', value: `$${report.demographics.threeMile.medianHomeValue.toLocaleString()}` },
                  { label: "Bachelor's+", value: `${report.demographics.threeMile.bachelorsPlusPct.toFixed(1)}%` },
                  { label: 'Age 65+', value: `${report.demographics.threeMile.age65PlusPct.toFixed(1)}%` },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-3 bg-slate-50 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
                    <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grade weights footnote */}
          <div className="text-xs text-slate-400 px-1">
            <span className="font-medium">Grading weights: </span>
            {Object.entries(grade.weightsSnapshot).map(([k, v], i, arr) => (
              <span key={k}>
                {CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS] ?? k} {(Number(v) * 100).toFixed(0)}%
                {i < arr.length - 1 ? ' · ' : ''}
              </span>
            ))}
            <span className="ml-3 text-slate-300">· Generated by ListOps Commercial</span>
          </div>

        </div>
      </div>
    </>
  )
}
