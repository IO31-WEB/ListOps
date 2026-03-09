'use client'

import { useState } from 'react'

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Bold header, full photo' },
  { id: 'luxury', label: 'Luxury', desc: 'Dark elegant with gold accents' },
  { id: 'modern', label: 'Modern', desc: 'Split layout, clean lines' },
]

const COLOR_SCHEMES = [
  { id: 'brand', label: 'Brand', desc: 'Your brand colors' },
  { id: 'navy', label: 'Navy', desc: 'Navy & gold' },
  { id: 'charcoal', label: 'Charcoal', desc: 'Charcoal & amber' },
  { id: 'forest', label: 'Forest', desc: 'Forest green & cream' },
  { id: 'burgundy', label: 'Burgundy', desc: 'Burgundy & champagne' },
]

export function PrintButton({ backUrl, planTier, initialTemplate }: {
  backUrl: string
  planTier: string
  initialTemplate: string
}) {
  const [template, setTemplate] = useState(initialTemplate || 'classic')
  const [scheme, setScheme] = useState('brand')

  const isStarter = ['starter', 'pro', 'brokerage', 'enterprise'].includes(planTier)
  const isPro = ['pro', 'brokerage', 'enterprise'].includes(planTier)

  const switchTemplate = (newTemplate: string) => {
    setTemplate(newTemplate)
    const url = new URL(window.location.href)
    url.searchParams.set('template', newTemplate)
    url.searchParams.set('scheme', scheme)
    window.location.href = url.toString()
  }

  const switchScheme = (newScheme: string) => {
    setScheme(newScheme)
    const url = new URL(window.location.href)
    url.searchParams.set('template', template)
    url.searchParams.set('scheme', newScheme)
    window.location.href = url.toString()
  }

  return (
    <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <a href={backUrl} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          ← Back
        </a>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Templates */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Template:</span>
            {TEMPLATES.map((t, i) => {
              const locked = i > 0 && !isStarter
              const active = template === t.id
              return (
                <button
                  key={t.id}
                  disabled={locked}
                  onClick={() => !locked && switchTemplate(t.id)}
                  title={locked ? 'Upgrade to Starter to unlock' : t.desc}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : locked
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {t.label}{locked ? ' 🔒' : ''}
                </button>
              )
            })}
          </div>

          {/* Color Schemes — Pro only */}
          {isPro && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Colors:</span>
              {COLOR_SCHEMES.map((s) => {
                const active = scheme === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => switchScheme(s.id)}
                    title={s.desc}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      active
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          )}

          {!isPro && isStarter && (
            <span className="text-xs text-slate-400">
              <a href="/dashboard/billing" className="text-amber-600 font-semibold hover:underline">Upgrade to Pro</a> for 5 color schemes per template
            </span>
          )}
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
