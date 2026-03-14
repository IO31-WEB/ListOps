'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Check, AlertTriangle, Loader2, Palette, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

type GenStatus = 'idle' | 'generating' | 'error'

interface GenStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done'
}

interface BrandKitStatus {
  planTier: string
  brandKitComplete: boolean
  agentName?: string
}

const STEPS: GenStep[] = [
  { id: 'mls',       label: 'Connecting to MLS & fetching listing data',          status: 'pending' },
  { id: 'listing',   label: 'Building listing copy & headline variations',          status: 'pending' },
  { id: 'social',    label: 'Writing 6-week social calendar (FB, IG, TikTok…)',    status: 'pending' },
  { id: 'email',     label: 'Writing email sequences & drip campaigns',             status: 'pending' },
  { id: 'video',     label: 'Writing reel scripts & virtual tour narration',        status: 'pending' },
  { id: 'saving',    label: 'Saving campaign to your account',                      status: 'pending' },
]

const STARTER_TIERS = ['starter', 'pro', 'commercial', 'brokerage', 'enterprise']
const STEP_INTERVAL_MS = 22_000

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const label = mins > 0 ? `${mins}m ${secs}s elapsed` : `${secs}s elapsed`
  return (
    <span className="text-xs text-slate-500 animate-pulse tabular-nums">
      {elapsed < 10 ? '~2 min remaining' : label}
    </span>
  )
}

function BrandKitPrompt({ onDismiss, onProceed }: { onDismiss: () => void; onProceed: () => void }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Palette className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Complete Your Brand Kit First</h3>
            <p className="text-xs text-slate-600 mt-0.5">Your plan includes branded campaigns — get the most out of it.</p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-slate-700 mb-4">
        Add your logo, headshot, brand colors, and agent tagline so every campaign we generate is 100% on-brand and ready to publish.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard/brand"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm"
        >
          <Palette className="w-4 h-4" />
          Set Up Brand Kit
        </Link>
        <button
          onClick={onProceed}
          className="flex-1 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all"
        >
          Skip for now, generate anyway
        </button>
      </div>
    </div>
  )
}

export default function GeneratePage() {
  const router = useRouter()
  const [mlsId, setMlsId]   = useState('')
  const [status, setStatus] = useState<GenStatus>('idle')
  const [steps, setSteps]   = useState<GenStep[]>(STEPS)
  const [error, setError]   = useState('')
  const [brandKitStatus, setBrandKitStatus] = useState<BrandKitStatus | null>(null)
  const [showBrandKitPrompt, setShowBrandKitPrompt] = useState(false)

  useEffect(() => {
    // Load billing info + brand kit status in parallel
    Promise.all([
      fetch('/api/billing/info').then(r => r.ok ? r.json() : null),
      fetch('/api/brand-kit').then(r => r.ok ? r.json() : null),
    ]).then(([billing, brandKit]) => {
      const planTier = billing?.planTier ?? 'free'
      const isStarterPlus = STARTER_TIERS.includes(planTier)
      // Brand kit is "complete" if they have at least agentName set
      const brandKitComplete = Boolean(brandKit?.brandKit?.agentName?.trim())
      setBrandKitStatus({ planTier, brandKitComplete, agentName: brandKit?.brandKit?.agentName })
      // Show prompt if on a paid plan and brand kit is empty
      if (isStarterPlus && !brandKitComplete) {
        setShowBrandKitPrompt(true)
      }
    }).catch(() => {})
  }, [])

  const updateStep = (id: string, s: GenStep['status']) =>
    setSteps(prev => prev.map(step => step.id === id ? { ...step, status: s } : step))

  const runGenerate = async () => {
    const trimmed = mlsId.trim()
    if (!trimmed) { toast.error('Please enter an MLS listing ID'); return }

    setStatus('generating')
    setError('')
    setSteps(STEPS.map(s => ({ ...s, status: 'pending' })))

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

  const handleGenerate = () => {
    const trimmed = mlsId.trim()
    if (!trimmed) { toast.error('Please enter an MLS listing ID'); return }

    // If Starter+ and brand kit is incomplete, show prompt (unless already dismissed)
    const isStarterPlus = brandKitStatus && STARTER_TIERS.includes(brandKitStatus.planTier)
    if (isStarterPlus && !brandKitStatus?.brandKitComplete && showBrandKitPrompt) {
      // Prompt is already showing — let them interact with it
      return
    }
    if (isStarterPlus && !brandKitStatus?.brandKitComplete && !showBrandKitPrompt) {
      // They dismissed the initial prompt but we still want to ask once more on click
      setShowBrandKitPrompt(true)
      return
    }

    runGenerate()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Generate Campaign</h1>
        <p className="text-sm text-slate-500 mt-1">Enter your MLS listing ID to create a complete 6-week campaign.</p>
      </div>

      {/* Brand kit prompt for Starter+ users who haven't set it up */}
      {showBrandKitPrompt && brandKitStatus && STARTER_TIERS.includes(brandKitStatus.planTier) && !brandKitStatus.brandKitComplete && (
        <BrandKitPrompt
          onDismiss={() => setShowBrandKitPrompt(false)}
          onProceed={() => { setShowBrandKitPrompt(false); runGenerate() }}
        />
      )}

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
              <ElapsedTimer />
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

// Step animation: advance through steps but STOP before 'saving' so it spins until the API responds
const STEP_INTERVAL_MS = 22_000

// Shows a live elapsed timer so users know the app is working, not frozen
function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const label = mins > 0 ? `${mins}m ${secs}s elapsed` : `${secs}s elapsed`
  return (
    <span className="text-xs text-slate-500 animate-pulse tabular-nums">
      {elapsed < 10 ? '~2 min remaining' : label}
    </span>
  )
}

