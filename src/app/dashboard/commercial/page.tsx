'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Upload, FileText, Building2, AlertCircle, Clock, ChevronRight, RefreshCw, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

interface ReportListItem {
  id: string
  propertyAddress: string
  propertyCity: string | null
  propertyState: string | null
  source: string
  rawPdfFilename: string | null
  parseError: string | null
  createdAt: string
  grade: {
    id: string
    overallGrade: string
    overallScore: string
    generatedAt: string
  } | null
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'A':  'text-emerald-700 bg-emerald-50 border-emerald-200',
  'A-': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'B+': 'text-blue-700 bg-blue-50 border-blue-200',
  'B':  'text-blue-700 bg-blue-50 border-blue-200',
  'B-': 'text-blue-700 bg-blue-50 border-blue-200',
  'C+': 'text-amber-700 bg-amber-50 border-amber-200',
  'C':  'text-amber-700 bg-amber-50 border-amber-200',
  'C-': 'text-amber-700 bg-amber-50 border-amber-200',
  'D+': 'text-orange-700 bg-orange-50 border-orange-200',
  'D':  'text-orange-700 bg-orange-50 border-orange-200',
  'D-': 'text-orange-700 bg-orange-50 border-orange-200',
  'F':  'text-red-700 bg-red-50 border-red-200',
}

export default function CommercialDashboardPage() {
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchReports() {
    try {
      const res = await fetch('/api/commercial/reports')
      if (res.status === 403) { setHasAccess(false); return }
      setHasAccess(true)
      const data = await res.json()
      setReports(data.items ?? [])
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReports() }, [])

  async function handleFileUpload(file: File) {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted')
      return
    }

    setUploading(true)
    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/commercial/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed')
        return
      }

      toast.success('PDF uploaded and parsed successfully')
      await fetchReports()

      // Auto-grade if parse succeeded
      if (data.hasData) {
        await gradeReport(data.reportId)
      }
    } catch {
      toast.error('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  async function gradeReport(reportId: string) {
    setGradingId(reportId)
    try {
      const res = await fetch('/api/commercial/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Grading failed')
        return
      }
      toast.success('Grade card generated')
      await fetchReports()
    } catch {
      toast.error('Grading failed — please try again')
    } finally {
      setGradingId(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  if (hasAccess === false) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Commercial Plan Required</h2>
          <p className="text-slate-600">
            Commercial site analysis and AI property grading are available on the Commercial plan ($179/mo),
            which includes everything in Pro plus AI-powered site analysis.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
          >
            Upgrade to Commercial <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-500" />
              Commercial Site Analysis
            </h1>
            <p className="mt-1 text-slate-500 text-sm">
              Upload property analytics reports to generate AI-powered site grade cards
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          className="border-2 border-dashed border-amber-300 rounded-2xl p-10 text-center bg-amber-50/40 hover:bg-amber-50/70 transition-colors cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
          {uploading ? (
            <div className="space-y-3">
              <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
              <p className="font-medium text-slate-700">Parsing property report with AI…</p>
              <p className="text-sm text-slate-500">This can take 20–60 seconds for multi-page reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="font-semibold text-slate-700">Drop a property analytics PDF here or click to browse</p>
              <p className="text-sm text-slate-500">
                Supports Consumer Spending, Demographic Detail, and Traffic Count reports from any commercial data provider
              </p>
              <p className="text-xs text-slate-400">Max 20 MB · PDF only</p>
            </div>
          )}
        </div>

        {/* Reports List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Reports ({reports.length})
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          )}

          {!loading && reports.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No reports yet — upload your first property analytics PDF above</p>
            </div>
          )}

          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-amber-300 transition-colors"
            >
              {/* Grade badge */}
              <div className="flex-shrink-0">
                {r.grade ? (
                  <div className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center font-bold ${GRADE_COLORS[r.grade.overallGrade] ?? 'text-slate-700 bg-slate-50 border-slate-200'}`}>
                    <span className="text-lg leading-none">{r.grade.overallGrade}</span>
                    <span className="text-xs opacity-70">{Number(r.grade.overallScore).toFixed(0)}</span>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{r.propertyAddress}</p>
                <p className="text-sm text-slate-500">
                  {[r.propertyCity, r.propertyState].filter(Boolean).join(', ')}
                  {r.propertyCity || r.propertyState ? ' · ' : ''}
                  {r.rawPdfFilename ?? r.source}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {r.parseError && (
                    <span className="ml-2 text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Parse failed
                    </span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!r.grade && !r.parseError && (
                  <button
                    onClick={() => gradeReport(r.id)}
                    disabled={gradingId === r.id}
                    className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {gradingId === r.id ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Grading…</>
                    ) : (
                      'Generate Grade'
                    )}
                  </button>
                )}
                {r.grade && (
                  <Link
                    href={`/dashboard/commercial/${r.id}`}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                  >
                    View Card <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Data Sources Panel */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-5">
          <div>
            <h3 className="font-semibold text-amber-400 mb-1">Supported Data Sources</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Upload PDFs from any commercial real estate analytics provider — our AI reads and
              normalizes the data automatically. You can also push structured data directly via API.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['ATTOM Data', 'Site To Do Business', 'Buxton', 'Demographics Now', 'Esri Business Analyst', 'Any CRE Report'].map((src) => (
              <span key={src} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300 font-medium">
                {src}
              </span>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-4">
            <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wide">Direct API Push</p>
            <p className="text-slate-500 text-xs mb-2">
              Automate data delivery from any source via Zapier, Make, or your own ETL pipeline:
            </p>
            <code className="block bg-slate-800 rounded-lg px-4 py-2.5 text-sm text-amber-300 font-mono">
              POST https://listops.io/api/commercial/data-push
            </code>
            <p className="text-slate-600 text-xs mt-2">
              Contact support for your webhook secret and integration docs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

