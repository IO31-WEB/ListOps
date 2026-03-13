'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Upload, FileText, Building2, AlertCircle, Clock, ChevronRight,
  RefreshCw, Lock, ChevronDown, ChevronUp, FileSearch, Mail, Zap,
  BarChart3, Globe, Download, Plus, X, Check, Send, Users,
  TrendingUp, Star, MapPin, DollarSign, Eye, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────

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
    aiSummary?: string | null
    aiStrengths?: string[] | null
    aiRisks?: string[] | null
  } | null
}

interface ToolPanelState {
  omBuilder: boolean
  emailCampaign: boolean
  teaser: boolean
  comps: boolean
  microsite: boolean
  pdfUpload: boolean
}

interface Prospect {
  email: string
  name?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const GRADE_HEX: Record<string, string> = {
  'A+': '#059669', 'A': '#059669', 'A-': '#34d399',
  'B+': '#2563eb', 'B': '#2563eb', 'B-': '#60a5fa',
  'C+': '#d97706', 'C': '#d97706', 'C-': '#fbbf24',
  'D+': '#ea580c', 'D': '#ea580c', 'D-': '#fb923c',
  'F':  '#dc2626',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ToolPanel({
  id,
  icon: Icon,
  title,
  description,
  badge,
  badgeColor = 'amber',
  isOpen,
  onToggle,
  children,
  disabled = false,
  disabledReason,
}: {
  id: string
  icon: React.ElementType
  title: string
  description: string
  badge?: string
  badgeColor?: 'amber' | 'blue' | 'emerald' | 'purple' | 'slate'
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  disabled?: boolean
  disabledReason?: string
}) {
  const badgeClasses: Record<string, string> = {
    amber:   'bg-amber-100 text-amber-800 border-amber-200',
    blue:    'bg-blue-100 text-blue-800 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    purple:  'bg-purple-100 text-purple-800 border-purple-200',
    slate:   'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
      isOpen ? 'border-amber-300 shadow-md shadow-amber-50' : 'border-slate-200 hover:border-slate-300'
    } ${disabled ? 'opacity-60' : ''}`}>
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className="w-full flex items-center gap-4 p-5 text-left group"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
          isOpen ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-amber-50 group-hover:text-amber-700'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{title}</span>
            {badge && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClasses[badgeColor]}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5 truncate">{disabled ? disabledReason ?? description : description}</p>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 p-5">
          {children}
        </div>
      )}
    </div>
  )
}

function ReportSelector({
  reports,
  selected,
  onSelect,
  label = 'Select a report to use as data source',
}: {
  reports: ReportListItem[]
  selected: string | null
  onSelect: (id: string) => void
  label?: string
}) {
  const gradedReports = reports.filter(r => r.grade)
  if (gradedReports.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        Upload and grade a report above first to use this feature.
      </div>
    )
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="grid gap-2">
        {gradedReports.map(r => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              selected === r.id
                ? 'border-amber-400 bg-amber-50'
                : 'border-slate-200 hover:border-amber-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              GRADE_COLORS[r.grade!.overallGrade] ?? 'text-slate-700 bg-slate-50 border-slate-200'
            }`}>
              {r.grade!.overallGrade}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{r.propertyAddress}</p>
              <p className="text-xs text-slate-500">
                {[r.propertyCity, r.propertyState].filter(Boolean).join(', ')}
              </p>
            </div>
            {selected === r.id && <Check className="w-4 h-4 text-amber-600 flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Feature Panels ──────────────────────────────────────────────────────────

function OmBuilderPanel({ reports }: { reports: ReportListItem[] }) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [omSections, setOmSections] = useState<Record<string, string> | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [propertyType, setPropertyType] = useState('Retail')
  const [askingPrice, setAskingPrice] = useState('')
  const [capRate, setCapRate] = useState('')

  const report = reports.find(r => r.id === selectedReport)

  const sectionOrder = [
    'executiveSummary',
    'propertyOverview',
    'financialHighlights',
    'marketAnalysis',
    'demographicsInsights',
    'investmentHighlights',
  ]
  const sectionLabels: Record<string, string> = {
    executiveSummary: 'Executive Summary',
    propertyOverview: 'Property Overview',
    financialHighlights: 'Financial Highlights',
    marketAnalysis: 'Market Analysis',
    demographicsInsights: 'Demographics & Traffic',
    investmentHighlights: 'Investment Highlights',
  }

  async function generateOM() {
    if (!selectedReport || !report) return
    setGenerating(true)
    try {
      const res = await fetch('/api/commercial/om-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedReport,
          propertyType,
          askingPrice: askingPrice || null,
          capRate: capRate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }
      setOmSections(data.sections)
      toast.success('Offering Memorandum generated!')
    } catch {
      toast.error('Generation failed — please try again')
    } finally {
      setGenerating(false)
    }
  }

  function startEdit(key: string) {
    setEditingSection(key)
    setEditContent(omSections![key])
  }

  function saveEdit() {
    if (!editingSection) return
    setOmSections(prev => ({ ...prev!, [editingSection]: editContent }))
    setEditingSection(null)
  }

  async function downloadPDF() {
    if (!omSections || !report) return
    const res = await fetch('/api/commercial/om-builder/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: selectedReport, sections: omSections, propertyType, askingPrice, capRate }),
    })
    if (!res.ok) { toast.error('PDF export failed'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OM-${report.propertyAddress.replace(/\s+/g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Offering Memorandum downloaded!')
  }

  return (
    <div className="space-y-5">
      <ReportSelector reports={reports} selected={selectedReport} onSelect={setSelectedReport} />

      {selectedReport && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Property Type</label>
              <select
                value={propertyType}
                onChange={e => setPropertyType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {['Retail', 'Office', 'Industrial', 'Mixed-Use', 'NNN Lease', 'Multi-Tenant', 'Medical Office', 'Restaurant Pad'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Asking Price (optional)</label>
              <input
                value={askingPrice}
                onChange={e => setAskingPrice(e.target.value)}
                placeholder="e.g. $4,200,000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cap Rate (optional)</label>
              <input
                value={capRate}
                onChange={e => setCapRate(e.target.value)}
                placeholder="e.g. 6.5%"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {!omSections ? (
            <button
              onClick={generateOM}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Generating OM (30–60 sec)…</>
              ) : (
                <><FileSearch className="w-4 h-4" /> Generate Offering Memorandum</>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">6 Sections Generated — click any to edit</p>
                <div className="flex gap-2">
                  <button
                    onClick={generateOM}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} /> Regenerate All
                  </button>
                  <button
                    onClick={downloadPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                </div>
              </div>

              {sectionOrder.map(key => (
                <div key={key} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">{sectionLabels[key]}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          // Regenerate single section
                          setGenerating(true)
                          try {
                            const res = await fetch('/api/commercial/om-builder/section', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ reportId: selectedReport, section: key, propertyType, askingPrice, capRate }),
                            })
                            const data = await res.json()
                            if (res.ok) setOmSections(prev => ({ ...prev!, [key]: data.content }))
                          } finally { setGenerating(false) }
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => editingSection === key ? setEditingSection(null) : startEdit(key)}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700"
                      >
                        {editingSection === key ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                  </div>
                  {editingSection === key ? (
                    <div className="p-4 space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-y"
                      />
                      <button
                        onClick={saveEdit}
                        className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                      >
                        Save Changes
                      </button>
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {omSections[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmailCampaignPanel({ reports }: { reports: ReportListItem[] }) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [campaignType, setCampaignType] = useState<'investor' | 'tenant'>('investor')
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [emailSequence, setEmailSequence] = useState<Array<{ subject: string; body: string; sendDay: number }> | null>(null)
  const [sending, setSending] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  function addProspect() {
    const email = emailInput.trim()
    if (!email || !email.includes('@')) { toast.error('Enter a valid email'); return }
    if (prospects.find(p => p.email === email)) { toast.error('Already added'); return }
    setProspects(prev => [...prev, { email, name: nameInput.trim() || undefined }])
    setEmailInput('')
    setNameInput('')
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split('\n').slice(1)
      const parsed: Prospect[] = lines
        .map(l => l.split(',').map(s => s.trim().replace(/"/g, '')))
        .filter(([email]) => email && email.includes('@'))
        .map(([email, name]) => ({ email, name: name || undefined }))
      setProspects(prev => {
        const existing = new Set(prev.map(p => p.email))
        return [...prev, ...parsed.filter(p => !existing.has(p.email))]
      })
      toast.success(`Imported ${parsed.length} prospects`)
    }
    reader.readAsText(file)
  }

  async function generateSequence() {
    if (!selectedReport) return
    setGenerating(true)
    try {
      const res = await fetch('/api/commercial/email-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport, campaignType }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }
      setEmailSequence(data.sequence)
      toast.success('5-email sequence generated!')
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function sendCampaign() {
    if (!emailSequence || prospects.length === 0) {
      toast.error('Add at least one prospect and generate the sequence first')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/commercial/email-campaign/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport, prospects, sequence: emailSequence }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Send failed'); return }
      toast.success(`Campaign launched to ${prospects.length} prospect${prospects.length !== 1 ? 's' : ''}!`)
    } catch {
      toast.error('Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <ReportSelector reports={reports} selected={selectedReport} onSelect={setSelectedReport} />

      {selectedReport && (
        <>
          {/* Campaign type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Campaign Type</label>
            <div className="flex gap-2">
              {(['investor', 'tenant'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCampaignType(t)}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-all capitalize ${
                    campaignType === t
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {t === 'investor' ? '📈 Investor Outreach' : '🏪 Tenant Prospecting'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {campaignType === 'investor'
                ? 'Focus: cap rates, NOI, investment returns, market position'
                : 'Focus: traffic counts, co-tenancy, demographics, site visibility'}
            </p>
          </div>

          {/* Prospect list */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Prospect List ({prospects.length})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Name (optional)"
                className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addProspect()}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={addProspect} className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <button
              onClick={() => csvRef.current?.click()}
              className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" /> Import CSV (email, name columns)
            </button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />

            {prospects.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {prospects.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                    <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                      {(p.name ?? p.email)[0].toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-700 flex-1 truncate">{p.name ? `${p.name} — ` : ''}{p.email}</span>
                    <button onClick={() => setProspects(prev => prev.filter((_, j) => j !== i))}>
                      <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate + Send */}
          <div className="flex gap-2">
            <button
              onClick={generateSequence}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-800 font-semibold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors text-sm"
            >
              {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate 5-Email Sequence</>}
            </button>
            {emailSequence && (
              <button
                onClick={sendCampaign}
                disabled={sending || prospects.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors text-sm"
              >
                {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Launch Campaign</>}
              </button>
            )}
          </div>

          {/* Preview sequence */}
          {emailSequence && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Sequence Preview</p>
              {emailSequence.map((email, i) => (
                <details key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                  <summary className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer select-none">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{email.subject}</p>
                      <p className="text-xs text-slate-400">Day {email.sendDay}</p>
                    </div>
                  </summary>
                  <div className="px-4 py-3 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap border-t border-slate-100">
                    {email.body}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TeaserPanel({ reports }: { reports: ReportListItem[] }) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [teaserData, setTeaserData] = useState<{
    headline: string
    keyStats: Array<{ label: string; value: string }>
    description: string
    cta: string
    slug?: string
  } | null>(null)

  const report = reports.find(r => r.id === selectedReport)

  async function generateTeaser() {
    if (!selectedReport) return
    setGenerating(true)
    try {
      const res = await fetch('/api/commercial/teaser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }
      setTeaserData(data)
      toast.success('Investment teaser generated!')
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <ReportSelector reports={reports} selected={selectedReport} onSelect={setSelectedReport} />

      {selectedReport && !teaserData && (
        <button
          onClick={generateTeaser}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {generating
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating teaser…</>
            : <><Star className="w-4 h-4" /> Generate Investment Teaser</>
          }
        </button>
      )}

      {teaserData && report && (
        <div className="space-y-4">
          {/* Preview card */}
          <div className="border-2 border-slate-900 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Investment Opportunity</span>
                <div className={`px-2 py-0.5 rounded text-xs font-bold border ${GRADE_COLORS[report.grade!.overallGrade] ?? ''}`}>
                  {report.grade!.overallGrade}
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{teaserData.headline}</h2>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {report.propertyAddress}{[report.propertyCity, report.propertyState].filter(Boolean).length ? `, ${[report.propertyCity, report.propertyState].filter(Boolean).join(', ')}` : ''}
              </p>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
              {teaserData.keyStats.slice(0, 3).map((stat, i) => (
                <div key={i} className="px-4 py-4 text-center">
                  <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 leading-relaxed">{teaserData.description}</p>
            </div>
            {/* CTA */}
            <div className="px-6 pb-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-800">{teaserData.cta}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={generateTeaser}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} /> Regenerate
            </button>
            {teaserData.slug && (
              <Link
                href={`/l/${teaserData.slug}`}
                target="_blank"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> View Shareable Page
              </Link>
            )}
            <button
              onClick={async () => {
                const res = await fetch('/api/commercial/teaser/pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reportId: selectedReport, teaserData }),
                })
                if (!res.ok) { toast.error('Export failed'); return }
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `Teaser-${report.propertyAddress.replace(/\s+/g, '-')}.pdf`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-400 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CompsPanel({ reports }: { reports: ReportListItem[] }) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [compAddresses, setCompAddresses] = useState<string[]>(['', '', ''])
  const [generating, setGenerating] = useState(false)
  const [compsData, setCompsData] = useState<{
    summary: string
    comps: Array<{
      address: string
      salePrice?: string
      pricePerSF?: string
      capRate?: string
      date?: string
      notes: string
    }>
    positioning: string
    recommendation: string
  } | null>(null)

  async function generateComps() {
    if (!selectedReport) return
    const addresses = compAddresses.filter(a => a.trim())
    setGenerating(true)
    try {
      const res = await fetch('/api/commercial/comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport, compAddresses: addresses }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }
      setCompsData(data)
      toast.success('Comps analysis complete!')
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <ReportSelector reports={reports} selected={selectedReport} onSelect={setSelectedReport} />

      {selectedReport && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Comparable Property Addresses (optional — Claude will estimate from market data if left blank)
            </label>
            {compAddresses.map((addr, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={addr}
                  onChange={e => {
                    const next = [...compAddresses]
                    next[i] = e.target.value
                    setCompAddresses(next)
                  }}
                  placeholder={`Comp ${i + 1} address…`}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {i > 0 && (
                  <button
                    onClick={() => setCompAddresses(prev => prev.filter((_, j) => j !== i))}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {compAddresses.length < 6 && (
              <button
                onClick={() => setCompAddresses(prev => [...prev, ''])}
                className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add comp
              </button>
            )}
          </div>

          <button
            onClick={generateComps}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {generating
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing comps…</>
              : <><BarChart3 className="w-4 h-4" /> Generate Comps Analysis</>
            }
          </button>

          {compsData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-700 mb-1">Market Overview</p>
                <p className="text-sm text-slate-600 leading-relaxed">{compsData.summary}</p>
              </div>

              {/* Comps table */}
              {compsData.comps.length > 0 && (
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Address</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Price</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">$/SF</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {compsData.comps.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 truncate max-w-[200px]">{c.address}</p>
                            {c.date && <p className="text-xs text-slate-400">{c.date}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{c.salePrice ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{c.pricePerSF ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{c.capRate ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Positioning */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Market Positioning</p>
                  <p className="text-sm text-blue-800 leading-relaxed">{compsData.positioning}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Pricing Recommendation</p>
                  <p className="text-sm text-emerald-800 leading-relaxed">{compsData.recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MicrositePanel({ reports }: { reports: ReportListItem[] }) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [micrositeSlug, setMicrositeSlug] = useState<string | null>(null)
  const [capRateCalc, setCapRateCalc] = useState({ noi: '', price: '' })

  const capRate = capRateCalc.noi && capRateCalc.price
    ? ((parseFloat(capRateCalc.noi) / parseFloat(capRateCalc.price)) * 100).toFixed(2)
    : null

  const report = reports.find(r => r.id === selectedReport)

  async function generateMicrosite() {
    if (!selectedReport) return
    setGenerating(true)
    try {
      const res = await fetch('/api/commercial/microsite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }
      setMicrositeSlug(data.slug)
      toast.success('Commercial microsite published!')
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <ReportSelector reports={reports} selected={selectedReport} onSelect={setSelectedReport} />

      {selectedReport && (
        <>
          {/* Cap rate calculator widget */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 text-white">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-3">Cap Rate Calculator Widget</p>
            <p className="text-xs text-slate-400 mb-3">This interactive widget will be embedded on the microsite</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Annual NOI</label>
                <input
                  value={capRateCalc.noi}
                  onChange={e => setCapRateCalc(p => ({ ...p, noi: e.target.value }))}
                  placeholder="e.g. 280000"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Asking Price</label>
                <input
                  value={capRateCalc.price}
                  onChange={e => setCapRateCalc(p => ({ ...p, price: e.target.value }))}
                  placeholder="e.g. 4200000"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            {capRate && (
              <div className="mt-3 text-center py-2 bg-amber-500/20 border border-amber-400/30 rounded-lg">
                <span className="text-2xl font-bold text-amber-400">{capRate}%</span>
                <p className="text-xs text-slate-400 mt-0.5">Cap Rate</p>
              </div>
            )}
          </div>

          {/* Microsite features */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              'AI-written property description',
              'Grade card embed',
              'Demographics chart',
              'Traffic count visualization',
              'Cap rate calculator',
              'NOI breakdown',
              'Contact form (Resend)',
              'Brand kit applied',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-slate-600">{f}</span>
              </div>
            ))}
          </div>

          {!micrositeSlug ? (
            <button
              onClick={generateMicrosite}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {generating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Building microsite…</>
                : <><Globe className="w-4 h-4" /> Publish Commercial Microsite</>
              }
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800">Microsite Live</p>
                  <p className="text-xs text-emerald-600 font-mono truncate">/l/{micrositeSlug}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/l/${micrositeSlug}`}
                  target="_blank"
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition-colors"
                >
                  <Eye className="w-4 h-4" /> View Microsite
                </Link>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/l/${micrositeSlug}`)
                    toast.success('URL copied!')
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Copy Link
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PDFUploadPanel({
  reports,
  onUploadComplete,
}: {
  reports: ReportListItem[]
  onUploadComplete: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [gradingId, setGradingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(file: File) {
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are accepted'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('File too large — max 20 MB'); return }
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/commercial/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      toast.success('PDF uploaded and parsed successfully')
      onUploadComplete()
      if (data.hasData) await gradeReport(data.reportId)
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
      if (!res.ok) { toast.error(data.error ?? 'Grading failed'); return }
      toast.success('Grade card generated')
      onUploadComplete()
    } catch {
      toast.error('Grading failed')
    } finally {
      setGradingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div
        className="border-2 border-dashed border-amber-300 rounded-2xl p-8 text-center bg-amber-50/40 hover:bg-amber-50/70 transition-colors cursor-pointer"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
        />
        {uploading ? (
          <div className="space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="font-medium text-slate-700">Parsing property report with AI…</p>
            <p className="text-sm text-slate-500">This can take 20–60 seconds for multi-page reports</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="font-semibold text-slate-700">Drop a property analytics PDF here or click to browse</p>
            <p className="text-sm text-slate-500">
              Consumer Spending · Demographic Detail · Traffic Count · Any CRE provider
            </p>
            <p className="text-xs text-slate-400">Max 20 MB · PDF only</p>
          </div>
        )}
      </div>

      {/* Reports list */}
      {reports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Uploaded Reports ({reports.length})</p>
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 hover:border-amber-200 transition-colors">
              <div className="flex-shrink-0">
                {r.grade ? (
                  <div className={`w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center font-bold text-sm ${GRADE_COLORS[r.grade.overallGrade] ?? 'text-slate-700 bg-slate-50 border-slate-200'}`}>
                    <span>{r.grade.overallGrade}</span>
                    <span className="text-xs opacity-60 font-normal">{Number(r.grade.overallScore).toFixed(0)}</span>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                    <FileText className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{r.propertyAddress}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {r.parseError && <span className="ml-1 text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Parse error</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!r.grade && !r.parseError && (
                  <button
                    onClick={() => gradeReport(r.id)}
                    disabled={gradingId === r.id}
                    className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    {gradingId === r.id ? <><RefreshCw className="w-3 h-3 animate-spin" /> Grading</> : 'Grade →'}
                  </button>
                )}
                {r.grade && (
                  <Link
                    href={`/dashboard/commercial/${r.id}`}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data sources */}
      <div className="bg-slate-900 rounded-xl p-4 text-white">
        <p className="text-xs font-semibold text-amber-400 mb-2">Supported Providers</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {['ATTOM Data', 'Site To Do Business', 'Buxton', 'Demographics Now', 'Esri', 'Any CRE Report'].map(src => (
            <span key={src} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300">{src}</span>
          ))}
        </div>
        <p className="text-xs text-slate-500 mb-1.5">Direct API push via Zapier, Make, or ETL:</p>
        <code className="block bg-slate-800 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono">
          POST /api/commercial/data-push
        </code>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CommercialDashboardPage() {
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [openPanels, setOpenPanels] = useState<ToolPanelState>({
    pdfUpload: true,       // open by default so users see the upload zone first
    omBuilder: false,
    emailCampaign: false,
    teaser: false,
    comps: false,
    microsite: false,
  })

  const hasGradedReports = reports.some(r => r.grade)

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

  function togglePanel(key: keyof ToolPanelState) {
    setOpenPanels(prev => ({ ...prev, [key]: !prev[key] }))
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
            Commercial site analysis, OM builder, investor campaigns, and broker microsites are available
            on the Commercial plan ($179/mo) — everything in Pro plus AI-powered CRE tooling.
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-3">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-amber-500" />
            <h1 className="text-2xl font-bold text-slate-900">Commercial Suite</h1>
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full">
              Commercial Plan
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            {reports.length === 0
              ? 'Start by uploading a property analytics PDF below, then unlock the full toolkit.'
              : `${reports.length} report${reports.length !== 1 ? 's' : ''} · ${reports.filter(r => r.grade).length} graded — select a tool below`
            }
          </p>
        </div>

        {/* ── 1. PDF Upload & Grader ────────────────────────────── */}
        <ToolPanel
          id="pdfUpload"
          icon={Upload}
          title="PDF Upload & Site Grader"
          description={reports.length > 0 ? `${reports.length} report${reports.length !== 1 ? 's' : ''} uploaded` : 'Upload property analytics PDFs to generate AI site grades'}
          isOpen={openPanels.pdfUpload}
          onToggle={() => togglePanel('pdfUpload')}
          badge="Start here"
          badgeColor="slate"
        >
          <PDFUploadPanel reports={reports} onUploadComplete={fetchReports} />
        </ToolPanel>

        {/* Divider with lock state messaging */}
        {!hasGradedReports && (
          <div className="flex items-center gap-3 py-2 px-1">
            <div className="flex-1 h-px bg-slate-200" />
            <p className="text-xs text-slate-400 whitespace-nowrap">Grade a report above to unlock the tools below</p>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        )}

        {/* ── 2. OM Builder ────────────────────────────────────── */}
        <ToolPanel
          id="omBuilder"
          icon={FileSearch}
          title="Offering Memorandum Builder"
          description="Generate a full professional OM — executive summary, financials, market analysis, and more"
          badge="High-impact"
          badgeColor="amber"
          isOpen={openPanels.omBuilder}
          onToggle={() => togglePanel('omBuilder')}
          disabled={!hasGradedReports}
          disabledReason="Upload and grade a report to enable"
        >
          <OmBuilderPanel reports={reports} />
        </ToolPanel>

        {/* ── 3. Investor / Tenant Email Campaigns ─────────────── */}
        <ToolPanel
          id="emailCampaign"
          icon={Mail}
          title="Investor & Tenant Email Campaigns"
          description="Auto-generate 5-email drip sequences, import prospect lists, and launch via Resend"
          badge="CRE-specific"
          badgeColor="blue"
          isOpen={openPanels.emailCampaign}
          onToggle={() => togglePanel('emailCampaign')}
          disabled={!hasGradedReports}
          disabledReason="Upload and grade a report to enable"
        >
          <EmailCampaignPanel reports={reports} />
        </ToolPanel>

        {/* ── 4. Investment Teaser ──────────────────────────────── */}
        <ToolPanel
          id="teaser"
          icon={Star}
          title="Investment Teaser / One-Pager"
          description="Branded 1-page teaser with key stats, grade, and CTA — shareable link or PDF download"
          badge="Quick win"
          badgeColor="emerald"
          isOpen={openPanels.teaser}
          onToggle={() => togglePanel('teaser')}
          disabled={!hasGradedReports}
          disabledReason="Upload and grade a report to enable"
        >
          <TeaserPanel reports={reports} />
        </ToolPanel>

        {/* ── 5. Market Comps ───────────────────────────────────── */}
        <ToolPanel
          id="comps"
          icon={BarChart3}
          title="Market Comparables Summary"
          description="$/SF trends, cap rate estimates, and positioning vs. comps — Claude synthesizes from your data"
          badge="Research"
          badgeColor="purple"
          isOpen={openPanels.comps}
          onToggle={() => togglePanel('comps')}
          disabled={!hasGradedReports}
          disabledReason="Upload and grade a report to enable"
        >
          <CompsPanel reports={reports} />
        </ToolPanel>

        {/* ── 6. Commercial Microsite ───────────────────────────── */}
        <ToolPanel
          id="microsite"
          icon={Globe}
          title="Broker-Branded Listing Microsite"
          description="CRE-specific page with grade card, demographics chart, cap rate calculator, contact form"
          badge="Stand out"
          badgeColor="blue"
          isOpen={openPanels.microsite}
          onToggle={() => togglePanel('microsite')}
          disabled={!hasGradedReports}
          disabledReason="Upload and grade a report to enable"
        >
          <MicrositePanel reports={reports} />
        </ToolPanel>

      </div>
    </div>
  )
}
