'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Check, AlertTriangle, Loader2, Palette, X, Hash, PenLine, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

type GenStatus = 'idle' | 'generating' | 'error'
type InputMode = 'mls' | 'manual' | 'url'

interface GenStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done'
}

interface ManualForm {
  address: string
  city: string
  state: string
  price: string
  bedrooms: string
  bathrooms: string
  sqft: string
  description: string
}

interface BrandKitStatus {
  planTier: string
  brandKitComplete: boolean
  agentName?: string
}

const STEPS: GenStep[] = [
  { id: 'mls',     label: 'Connecting to MLS & fetching listing data',       status: 'pending' },
  { id: 'listing', label: 'Building listing copy & headline variations',       status: 'pending' },
  { id: 'social',  label: 'Writing 6-week social calendar (FB, IG, TikTok…)', status: 'pending' },
  { id: 'email',   label: 'Writing email sequences & drip campaigns',          status: 'pending' },
  { id: 'video',   label: 'Writing reel scripts & virtual tour narration',     status: 'pending' },
  { id: 'saving',  label: 'Saving campaign to your account',                   status: 'pending' },
]

const MANUAL_STEPS: GenStep[] = [
  { id: 'listing', label: 'Building listing copy & headline variations',       status: 'pending' },
  { id: 'social',  label: 'Writing 6-week social calendar (FB, IG, TikTok…)', status: 'pending' },
  { id: 'email',   label: 'Writing email sequences & drip campaigns',          status: 'pending' },
  { id: 'video',   label: 'Writing reel scripts & virtual tour narration',     status: 'pending' },
  { id: 'saving',  label: 'Saving campaign to your account',                   status: 'pending' },
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
      {elapsed < 15 ? '~2 min remaining' : label}
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
  const [inputMode, setInputMode] = useState<InputMode>('mls')
  const [mlsId, setMlsId] = useState('')
  const [listingUrl, setListingUrl] = useState('')
  const [manual, setManual] = useState<ManualForm>({
    address: '', city: '', state: '', price: '',
    bedrooms: '', bathrooms: '', sqft: '', description: '',
  })
  const [status, setStatus] = useState<GenStatus>('idle')
  const [steps, setSteps] = useState<GenStep[]>(STEPS)
  const [error, setError] = useState('')
  const [brandKitStatus, setBrandKitStatus] = useState<BrandKitStatus | null>(null)
  const [showBrandKitPrompt, setShowBrandKitPrompt] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/info').then(r => r.ok ? r.json() : null),
      fetch('/api/brand-kit').then(r => r.ok ? r.json() : null),
    ]).then(([billing, brandKit]) => {
      const planTier = billing?.planTier ?? 'free'
      const isStarterPlus = STARTER_TIERS.includes(planTier)
      const brandKitComplete = Boolean(brandKit?.brandKit?.agentName?.trim())
      setBrandKitStatus({ planTier, brandKitComplete })
      if (isStarterPlus && !brandKitComplete) setShowBrandKitPrompt(true)
    }).catch(() => {})
  }, [])

  const setM = (key: keyof ManualForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setManual(prev => ({ ...prev, [key]: e.target.value }))

  const updateStep = (id: string, s: GenStep['status']) =>
    setSteps(prev => prev.map(step => step.id === id ? { ...step, status: s } : step))

  const runGenerate = async (payload: Record<string, any>) => {
    const activeSteps = inputMode === 'mls' ? STEPS : MANUAL_STEPS
    setStatus('generating')
    setError('')
    setSteps(activeSteps.map(s => ({ ...s, status: 'pending' })))

    const stepIds = activeSteps.map(s => s.id)
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
        body: JSON.stringify(payload),
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
    // Validate
    if (inputMode === 'mls' && !mlsId.trim()) { toast.error('Please enter an MLS listing ID'); return }
    if (inputMode === 'url' && !listingUrl.trim()) { toast.error('Please enter a listing URL'); return }
    if (inputMode === 'manual' && !manual.address.trim()) { toast.error('Please enter at least a property address'); return }

    const isStarterPlus = brandKitStatus && STARTER_TIERS.includes(brandKitStatus.planTier)
    if (isStarterPlus && !brandKitStatus?.brandKitComplete && showBrandKitPrompt) return
    if (isStarterPlus && !brandKitStatus?.brandKitComplete && !showBrandKitPrompt) {
      setShowBrandKitPrompt(true)
      return
    }

    if (inputMode === 'mls') {
      runGenerate({ mlsId: mlsId.trim() })
    } else if (inputMode === 'url') {
      // Pass URL as mlsId — the API will attempt to use it as an identifier
      // and fall back to demo data with the URL as context
      runGenerate({ mlsId: `url:${listingUrl.trim()}`, listingUrl: listingUrl.trim() })
    } else {
      // Manual: send as mlsId with manual data attached
      runGenerate({
        mlsId: `manual:${manual.address.trim()}`,
        manualListing: {
          address: manual.address,
          city: manual.city,
          state: manual.state,
          price: manual.price ? parseFloat(manual.price.replace(/[^0-9.]/g, '')) : null,
          bedrooms: manual.bedrooms ? parseInt(manual.bedrooms) : null,
          bathrooms: manual.bathrooms ? parseFloat(manual.bathrooms) : null,
          sqft: manual.sqft ? parseInt(manual.sqft) : null,
          description: manual.description,
        },
      })
    }
  }

  const inputValid = (
    (inputMode === 'mls' && mlsId.trim()) ||
    (inputMode === 'url' && listingUrl.trim()) ||
    (inputMode === 'manual' && manual.address.trim())
  )

  const INPUT_TABS: { id: InputMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'mls', label: 'MLS ID', icon: Hash },
    { id: 'manual', label: 'Enter Manually', icon: PenLine },
    { id: 'url', label: 'Listing URL', icon: Link2 },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Generate Campaign</h1>
        <p className="text-sm text-slate-500 mt-1">Create a complete 6-week campaign from any listing source.</p>
      </div>

      {showBrandKitPrompt && brandKitStatus && STARTER_TIERS.includes(brandKitStatus.planTier) && !brandKitStatus.brandKitComplete && (
        <BrandKitPrompt
          onDismiss={() => setShowBrandKitPrompt(false)}
          onProceed={() => { setShowBrandKitPrompt(false); handleGenerate() }}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Input mode tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          {INPUT_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setInputMode(tab.id); setStatus('idle'); setError('') }}
              disabled={status === 'generating'}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all border-b-2 ${
                inputMode === tab.id
                  ? 'bg-white text-slate-900 border-amber-400'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/60'
              } disabled:opacity-50`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'mls' ? 'MLS' : tab.id === 'manual' ? 'Manual' : 'URL'}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* MLS ID input */}
          {inputMode === 'mls' && (
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-900 mb-2">MLS Listing ID</label>
              <input
                type="text"
                value={mlsId}
                onChange={e => setMlsId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && status !== 'generating' && handleGenerate()}
                placeholder="e.g. 1234567 or TX-MLS-12345"
                disabled={status === 'generating'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
              />
              <p className="text-xs text-slate-500 mt-2">
                Connected via SimplyRETS MLS API · Supports 500+ MLS boards nationwide
              </p>
            </div>
          )}

          {/* URL input */}
          {inputMode === 'url' && (
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-900 mb-2">Listing URL</label>
              <input
                type="url"
                value={listingUrl}
                onChange={e => setListingUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && status !== 'generating' && handleGenerate()}
                placeholder="https://www.zillow.com/homes/... or any MLS portal URL"
                disabled={status === 'generating'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
              />
              <p className="text-xs text-slate-500 mt-2">
                Paste any Zillow, Realtor.com, Redfin, or MLS portal listing URL
              </p>
            </div>
          )}

          {/* Manual input */}
          {inputMode === 'manual' && (
            <div className="mb-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Property Address <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={manual.address}
                  onChange={setM('address')}
                  placeholder="123 Oak Street"
                  disabled={status === 'generating'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">City</label>
                  <input type="text" value={manual.city} onChange={setM('city')} placeholder="Austin"
                    disabled={status === 'generating'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">State</label>
                  <input type="text" value={manual.state} onChange={setM('state')} placeholder="TX"
                    disabled={status === 'generating'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">List Price</label>
                  <input type="text" value={manual.price} onChange={setM('price')} placeholder="$649,000"
                    disabled={status === 'generating'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sq Ft</label>
                  <input type="text" value={manual.sqft} onChange={setM('sqft')} placeholder="2,450"
                    disabled={status === 'generating'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bedrooms</label>
                  <input type="text" value={manual.bedrooms} onChange={setM('bedrooms')} placeholder="4"
                    disabled={status === 'generating'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bathrooms</label>
                  <input type="text" value={manual.bathrooms} onChange={setM('bathrooms')} placeholder="2.5"
                    disabled={status === 'generating'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Property Description</label>
                <textarea
                  value={manual.description}
                  onChange={setM('description')}
                  placeholder="Describe the property — features, finishes, location highlights, anything that makes it special…"
                  rows={4}
                  disabled={status === 'generating'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">The more detail you provide, the better the campaign output.</p>
              </div>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={status === 'generating' || !inputValid}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'generating'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Zap className="w-4 h-4 text-amber-400" /> Generate Campaign</>
            }
          </button>

          {/* Progress steps */}
          {status === 'generating' && (
            <div className="border-t border-slate-100 pt-5 mt-5 space-y-3">
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
                    step.status === 'done'   ? 'text-slate-400 line-through' : 'text-slate-400'
                  }`}>{step.label}</span>
                  {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin ml-auto" />}
                </div>
              ))}
            </div>
          )}
        </div>
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
            <button onClick={() => setStatus('idle')} className="text-xs text-red-600 hover:text-red-800 mt-2 underline block">
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

interface BrandKitStatus {
  planTier: string
  brandKitComplete: boolean
  agentName?: string
}

