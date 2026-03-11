'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Check, AlertTriangle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

type GenStatus = 'idle' | 'generating' | 'error'

interface GenStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done'
}

const STEPS: GenStep[] = [
  { id: 'mls',       label: 'Connecting to MLS & fetching listing data',          status: 'pending' },
  { id: 'listing',   label: 'Building listing copy & headline variations',          status: 'pending' },
  { id: 'social',    label: 'Writing 6-week social calendar (FB, IG, TikTok…)',    status: 'pending' },
  { id: 'email',     label: 'Writing email sequences & drip campaigns',             status: 'pending' },
  { id: 'video',     label: 'Writing reel scripts & virtual tour narration',        status: 'pending' },
  { id: 'saving',    label: 'Saving campaign to your account',                      status: 'pending' },
]

// Step animation cadence matches ~60s total generation time
const STEP_INTERVAL_MS = 9_500

export default function GeneratePage() {
  const router = useRouter()
  const [mlsId, setMlsId]   = useState('')
  const [status, setStatus] = useState<GenStatus>('idle')
  const [steps, setSteps]   = useState<GenStep[]>(STEPS)
  const [error, setError]   = useState('')

  const updateStep = (id: string, s: GenStep['status']) =>
    setSteps(prev => prev.map(step => step.id === id ? { ...step, status: s } : step))

  const handleGenerate = async () => {
    const trimmed = mlsId.trim()
    if (!trimmed) { toast.error('Please enter an MLS listing ID'); return }

    setStatus('generating')
    setError('')
    setSteps(STEPS.map(s => ({ ...s, status: 'pending' })))

    // Animate steps while the API runs — purely cosmetic
    const stepIds = STEPS.map(s => s.id)
    let stepIdx = 0
    updateStep(stepIds[0], 'active')

    const timer = setInterval(() => {
      if (stepIdx < stepIds.length - 1) {
        updateStep(stepIds[stepIdx], 'done')
        stepIdx++
        updateStep(stepIds[stepIdx], 'active')
      }
    }, STEP_INTERVAL_MS)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mlsId: trimmed }),
      })

      clearInterval(timer)
      stepIds.forEach(id => updateStep(id, 'done'))

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          setError(data.error || 'Campaign limit reached. Please upgrade.')
          setStatus('error')
          return
        }
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      if (!data.campaignId) throw new Error('Campaign was saved but no ID was returned.')

      toast.success('Campaign ready! Redirecting…')
      router.push(`/dashboard/campaigns/${data.campaignId}`)

    } catch (err: unknown) {
      clearInterval(timer)
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
      setStatus('error')
      toast.error(msg)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Generate Campaign</h1>
        <p className="text-sm text-slate-500 mt-1">Enter your MLS listing ID to create a complete 6-week campaign.</p>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-900 mb-2">MLS Listing ID</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={mlsId}
              onChange={e => setMlsId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && status !== 'generating' && handleGenerate()}
              placeholder="e.g. 1234567 or TX-MLS-12345"
              disabled={status === 'generating'}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={handleGenerate}
              disabled={status === 'generating' || !mlsId.trim()}
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'generating'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Zap className="w-4 h-4 text-amber-400" /> Generate Campaign</>
              }
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Connected via SimplyRETS MLS API · Supports 500+ MLS boards nationwide
          </p>
        </div>

        {/* Progress steps */}
        {status === 'generating' && (
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Building Your Campaign</p>
              <span className="text-xs text-slate-500 animate-pulse">~60 seconds</span>
            </div>
            {steps.map(step => (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  step.status === 'done'   ? 'bg-green-500' :
                  step.status === 'active' ? 'bg-amber-400' : 'bg-slate-200'
                }`}>
                  {step.status === 'done'   ? <Check className="w-3 h-3 text-white" /> :
                   step.status === 'active' ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> :
                   <div className="w-2 h-2 bg-slate-400 rounded-full" />}
                </div>
                <span className={`text-sm transition-all ${
                  step.status === 'active' ? 'text-slate-900 font-semibold' :
                  step.status === 'done'   ? 'text-slate-400 line-through'  : 'text-slate-400'
                }`}>{step.label}</span>
                {step.status === 'active' && (
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin ml-auto" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error state */}
      {status === 'error' && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">{error}</p>
            {error.toLowerCase().includes('limit') && (
              <Link href="/dashboard/billing" className="text-xs text-red-700 underline mt-1 inline-block">
                Upgrade your plan →
              </Link>
            )}
            <button
              onClick={() => setStatus('idle')}
              className="text-xs text-red-600 hover:text-red-800 mt-2 underline block"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
