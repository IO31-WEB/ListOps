'use client'

import { useState, useEffect } from 'react'

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Bold header, full photo' },
  { id: 'luxury', label: 'Luxury', desc: 'Dark elegant with gold accents' },
  { id: 'modern', label: 'Modern', desc: 'Split layout, clean lines' },
]

export function PrintButton({ backUrl, planTier, initialTemplate }: { backUrl: string; planTier: string; initialTemplate: string }) {
  const [template, setTemplate] = useState(initialTemplate || 'classic')
  const hasMultipleTemplates = ['starter', 'pro', 'commercial', 'brokerage', 'enterprise'].includes(planTier)
  const hasAllTemplates = ['pro', 'commercial', 'brokerage', 'enterprise'].includes(planTier)

  const switchTemplate = (newTemplate: string) => {
    setTemplate(newTemplate)
    const url = new URL(window.location.href)
    url.searchParams.set('template', newTemplate)
    window.location.href = url.toString()
  }

  return (
    <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <a href={backUrl} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          ← Back
        </a>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Template:</span>
          {TEMPLATES.map((t, i) => {
            const locked = (i === 1 && !hasMultipleTemplates) || (i === 2 && !hasAllTemplates)
            const active = template === t.id
            return (
              <button
                key={t.id}
                disabled={locked}
                onClick={() => !locked && switchTemplate(t.id)}
                title={locked ? `Upgrade to unlock` : t.desc}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : locked
                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                }`}
              >
                {t.label}{locked ? ' 🔒' : ''}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => window.print()}
          className="bg-slate-900 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          🖨️ Print / Save PDF
        </button>
      </div>
    </div>
  )
}
