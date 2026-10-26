'use client'

import { getBillingInfo, invalidateBillingInfo } from '@/lib/billing-client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Zap, Check, AlertTriangle, Loader2, Palette, X, Sparkles, ImagePlus, Trash2, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { track } from '@/lib/analytics'
import { scanText, applyRewrites } from '@/lib/compliance/fair-housing'
import { applyCompliance, type OrgCompliance } from '@/lib/compliance/brand'
import { brandWarnings } from '@/lib/compliance/warnings'
import { USE_TYPES, USE_TYPE_LABEL, type UseType } from '@/lib/commercial/types'

type GenStatus = 'idle' | 'generating' | 'error'

interface GenStep { id: string; label: string; status: 'pending' | 'active' | 'done' }

interface BrandKitStatus { planTier: string; brandKitComplete: boolean }

interface Photo {
  id: string
  preview: string
  status: 'uploading' | 'done' | 'error'
  key?: string
  error?: string
}

interface Form {
  address: string; city: string; state: string; zip: string
  price: string; bedrooms: string; bathrooms: string; sqft: string; yearBuilt: string
  propertyType: string; description: string
}

const EMPTY_FORM: Form = {
  address: '', city: '', state: '', zip: '', price: '', bedrooms: '', bathrooms: '',
  sqft: '', yearBuilt: '', propertyType: '', description: '',
}

const PROPERTY_TYPES = ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Land', 'Mobile/Manufactured', 'Other']
type Mode = 'residential' | 'commercial'
interface CreForm { useType: UseType | ''; offering: 'sale' | 'lease'; units: string; lotAcres: string; priceGuidance: string; noi: string; capRate: string; zoning: string; occupancy: string; brokerRemarks: string }
const EMPTY_CRE: CreForm = { useType: '', offering: 'sale', units: '', lotAcres: '', priceGuidance: '', noi: '', capRate: '', zoning: '', occupancy: '', brokerRemarks: '' }
// listing.propertyType values the API accepts for each commercial use type
const CRE_PROPERTY_TYPE: Record<UseType, string> = { retail: 'Retail', office: 'Office', industrial: 'Industrial', multifamily: 'Multifamily', mixed_use: 'Mixed-use', land: 'Land (commercial)', other: 'Other' }

const MAX_PHOTOS = 20
const RECOMMENDED_PHOTOS = 5

const STEPS: GenStep[] = [
  { id: 'listing', label: 'Analyzing your photos & building listing copy', status: 'pending' },
  { id: 'social',  label: 'Writing 6-week social calendar (FB, IG, TikTok…)', status: 'pending' },
  { id: 'email',   label: 'Writing email templates',         status: 'pending' },
  { id: 'video',   label: 'Writing reel scripts & virtual tour narration',    status: 'pending' },
  { id: 'saving',  label: 'Saving campaign to your account',                  status: 'pending' },
]

const COMMERCIAL_STEPS: GenStep[] = [
  { id: 'offering', label: 'Writing the offering teaser, one-pager and narrative', status: 'pending' },
  { id: 'social',   label: 'Writing LinkedIn and Facebook posts (6 weeks)',        status: 'pending' },
  { id: 'email',    label: 'Writing the broker / investor email sequence',         status: 'pending' },
  { id: 'print',    label: 'Preparing the one-sheet and teaser page copy',         status: 'pending' },
  { id: 'saving',   label: 'Saving campaign to your account',                      status: 'pending' },
]

const STARTER_TIERS = ['starter', 'pro', 'commercial', 'brokerage', 'enterprise']
const STEP_INTERVAL_MS = 22_000

const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

/**
 * Downscale in the browser before upload. Vercel rejects request bodies > ~4.5 MB and
 * Claude Vision caps images at 5 MB, so a 2000px / q0.85 JPEG (~300-700 KB) is the sweet
 * spot: fast uploads, cheap tokens, still plenty of detail for captions.
 */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85)
  )
}

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
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [mode, setMode] = useState<Mode>('residential')
  const [cre, setCre] = useState<CreForm>(EMPTY_CRE)
  const [features, setFeatures] = useState<string[]>([])
  const [featureInput, setFeatureInput] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [status, setStatus] = useState<GenStatus>('idle')
  const [steps, setSteps] = useState<GenStep[]>(STEPS)
  const [error, setError] = useState('')
  const [brandKitStatus, setBrandKitStatus] = useState<BrandKitStatus | null>(null)
  const [showBrandKitPrompt, setShowBrandKitPrompt] = useState(false)

  const [enrichEnabled, setEnrichEnabled] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichedFrom, setEnrichedFrom] = useState<string | null>(null)

  const listingIdRef = useRef<string | null>(null) // reuse the saved listing if the user retries
  const photosRef = useRef<Photo[]>([])
  photosRef.current = photos

  const busy = status === 'generating'

  useEffect(() => {
    track('generate_page_viewed')
    if (new URLSearchParams(window.location.search).get('type') === 'commercial') setMode('commercial')
    Promise.all([
      getBillingInfo(),
      fetch('/api/brand-kit').then(r => (r.ok ? r.json() : null)),
      fetch('/api/listings/enrich').then(r => (r.ok ? r.json() : null)),
    ])
      .then(([billing, brandKit, enrich]) => {
        const planTier = billing?.planTier ?? 'free'
        const eff = applyCompliance(brandKit?.brandKit, (brandKit?.compliance ?? null) as OrgCompliance | null, brandKit?.licenseNumber)
        const brandKitComplete = !brandWarnings(eff, { licenseNumber: brandKit?.licenseNumber }).some(w => w.level === 'required')
        setBrandKitStatus({ planTier, brandKitComplete })
        if (STARTER_TIERS.includes(planTier) && !brandKitComplete) setShowBrandKitPrompt(true)
        setEnrichEnabled(Boolean(enrich?.enabled))
      })
      .catch(() => {})
    // free object URLs on unmount
    return () => photosRef.current.forEach(p => URL.revokeObjectURL(p.preview))
  }, [])

  const setCreField = (k: keyof CreForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setCre(prev => ({ ...prev, [k]: e.target.value }))
  const commercial = mode === 'commercial'

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  // ── Photos ─────────────────────────────────────────────────
  const uploadOne = useCallback(async (file: File, id: string) => {
    const patch = (p: Partial<Photo>) => setPhotos(prev => prev.map(x => (x.id === id ? { ...x, ...p } : x)))
    try {
      const blob = await compressImage(file)
      const fd = new FormData()
      fd.append('file', blob, 'photo.jpg')
      const res = await fetch('/api/uploads/listing-photo', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      patch({ status: 'done', key: data.key })
    } catch (e) {
      patch({ status: 'error', error: e instanceof Error ? e.message : 'Upload failed' })
    }
  }, [])

  const onDrop = useCallback(
    (accepted: File[]) => {
      const room = MAX_PHOTOS - photosRef.current.length
      if (accepted.length > room) toast.error(`You can add up to ${MAX_PHOTOS} photos.`)
      const take = accepted.slice(0, Math.max(0, room))
      track('photos_added', { count: take.length, total_after: photosRef.current.length + take.length })
      const added: Photo[] = take.map(f => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        preview: URL.createObjectURL(f),
        status: 'uploading',
      }))
      setPhotos(prev => [...prev, ...added])
      // modest concurrency so a 20-photo batch doesn't open 20 connections at once
      let next = 0
      const worker = async () => {
        while (next < take.length) {
          const i = next++
          await uploadOne(take[i], added[i].id)
        }
      }
      void Promise.all([worker(), worker(), worker()])
    },
    [uploadOne]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: 25 * 1024 * 1024, // raw camera files are fine; we shrink them before upload
    disabled: busy,
    onDropRejected: () => toast.error('Use JPG, PNG or WebP photos (HEIC: export as JPG first).'),
  })

  // ── Reordering ─────────────────────────────────────────────
  // Order = order of the photos array. Only uploaded photos count toward the "first 4 go to the AI" rule,
  // and the server preserves array order, so what you see here is exactly what Claude receives.
  const [dragId, setDragId] = useState<string | null>(null)
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setPhotos(prev => {
      const from = prev.findIndex(p => p.id === fromId)
      const to = prev.findIndex(p => p.id === toId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  const nudge = (id: string, delta: -1 | 1) =>
    setPhotos(prev => {
      const i = prev.findIndex(p => p.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const p = prev.find(x => x.id === id)
      if (p) URL.revokeObjectURL(p.preview)
      return prev.filter(x => x.id !== id)
    })
  }

  // ── Enrichment ─────────────────────────────────────────────
  const handleEnrich = async () => {
    if (!form.address.trim() || !form.state.trim()) {
      toast.error('Enter the street address and state first.')
      return
    }
    setEnriching(true)
    track('enrich_clicked')
    try {
      const res = await fetch('/api/listings/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: form.address, city: form.city || undefined, state: form.state, zip: form.zip || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Lookup failed')
      track('enrich_result', { found: Boolean(data.found), reason: data.reason ?? null })
      if (!data.found) {
        toast('No public record found — please enter the details manually.', { icon: 'ℹ️' })
        return
      }
      const d = data.data as {
        provider: string; bedrooms?: number; bathrooms?: number; sqft?: number; yearBuilt?: number
        propertyType?: string; zip?: string; features: string[]
      }
      // Only fill what the agent hasn't typed — never overwrite their input.
      setForm(prev => ({
        ...prev,
        zip: prev.zip || d.zip || '',
        bedrooms: prev.bedrooms || (d.bedrooms ? String(d.bedrooms) : ''),
        bathrooms: prev.bathrooms || (d.bathrooms ? String(d.bathrooms) : ''),
        sqft: prev.sqft || (d.sqft ? String(d.sqft) : ''),
        yearBuilt: prev.yearBuilt || (d.yearBuilt ? String(d.yearBuilt) : ''),
        propertyType: prev.propertyType || d.propertyType || '',
      }))
      setFeatures(prev => Array.from(new Set([...prev, ...(d.features ?? [])])).slice(0, 25))
      setEnrichedFrom(d.provider)
      toast.success('Filled from public records — please double-check everything.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setEnriching(false)
    }
  }

  const addFeature = () => {
    const f = featureInput.trim().slice(0, 60)
    if (f && features.length < 25 && !features.includes(f)) setFeatures(prev => [...prev, f])
    setFeatureInput('')
  }

  // ── Generate ───────────────────────────────────────────────
  const updateStep = (id: string, s: GenStep['status']) =>
    setSteps(prev => prev.map(step => (step.id === id ? { ...step, status: s } : step)))

  const uploadedKeys = photos.filter(p => p.status === 'done' && p.key).map(p => p.key as string)
  const stillUploading = photos.some(p => p.status === 'uploading')

  const validate = (): string | null => {
    if (!form.address.trim()) return 'Please enter the property address.'
    if (!form.city.trim()) return 'Please enter the city.'
    if (!/^[A-Za-z]{2}$/.test(form.state.trim())) return 'Please enter a 2-letter state (e.g. SC).'
    if (commercial) {
      if (!cre.useType) return 'Choose the property type.'
      if (!form.sqft.trim() && !cre.units.trim() && !cre.lotAcres.trim()) return 'Enter the size: square feet, units or acres.'
    }
    if (uploadedKeys.length < 1) return 'Add at least one photo of the property.'
    if (stillUploading) return 'Photos are still uploading — one moment.'
    return null
  }

  const buildPayload = () => {
    const num = (s: string) => (s.trim() ? Number(s.replace(/[^0-9.]/g, '')) : null)
    const baths = num(form.bathrooms)
    if (commercial && cre.useType) {
      const n = (s: string) => (s.trim() ? num(s) : undefined)
      return {
        address: form.address.trim(), city: form.city.trim(), state: form.state.trim().toUpperCase(), zip: form.zip.trim() || undefined,
        price: num(form.price) != null ? Math.round(num(form.price) as number) : null,
        bedrooms: null, bathrooms: null,
        sqft: num(form.sqft) != null ? Math.round(num(form.sqft) as number) : null,
        yearBuilt: num(form.yearBuilt) != null ? Math.round(num(form.yearBuilt) as number) : null,
        propertyType: CRE_PROPERTY_TYPE[cre.useType],
        features, description: form.description.trim() || undefined, photoKeys: uploadedKeys, source: 'manual' as const,
        commercial: {
          useType: cre.useType, offering: cre.offering,
          units: n(cre.units) != null ? Math.round(n(cre.units) as number) : undefined, lotAcres: n(cre.lotAcres),
          priceGuidance: cre.priceGuidance.trim() || undefined, noi: n(cre.noi), capRatePct: n(cre.capRate),
          zoning: cre.zoning.trim() || undefined, occupancyNotes: cre.occupancy.trim() || undefined, brokerRemarks: cre.brokerRemarks.trim() || undefined,
        },
      }
    }
    return {
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      zip: form.zip.trim() || undefined,
      price: num(form.price) != null ? Math.round(num(form.price) as number) : null,
      bedrooms: num(form.bedrooms) != null ? Math.round(num(form.bedrooms) as number) : null,
      bathrooms: baths != null ? Math.round(baths * 2) / 2 : null,
      sqft: num(form.sqft) != null ? Math.round(num(form.sqft) as number) : null,
      yearBuilt: num(form.yearBuilt) != null ? Math.round(num(form.yearBuilt) as number) : null,
      propertyType: form.propertyType || undefined,
      features,
      description: form.description.trim() || undefined,
      photoKeys: uploadedKeys,
      source: enrichedFrom ? 'enriched' : 'manual',
      enrichmentProvider: enrichedFrom ?? undefined,
    }
  }

  const handleGenerate = async () => {
    const problem = validate()
    if (problem) { toast.error(problem); return }

    track('generate_clicked', { type: mode, photo_count: uploadedKeys.length, enriched: Boolean(enrichedFrom), features: features.length, has_description: Boolean(form.description.trim()) })
    setStatus('generating')
    setError('')
    const stepDefs = commercial ? COMMERCIAL_STEPS : STEPS
    setSteps(stepDefs.map(s => ({ ...s, status: 'pending' })))
    const startedAt = Date.now()
    const stepIds = stepDefs.map(s => s.id)
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
      // 1) save (or update, on retry) the listing
      const id = listingIdRef.current
      const saveRes = await fetch(id ? `/api/listings/${id}` : '/api/listings', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const saved = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) throw new Error(saved.error || 'Could not save the listing.')
      listingIdRef.current = saved.id

      // 2) generate
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: saved.id }),
      })
      clearInterval(timer)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      stepIds.forEach(sid => updateStep(sid, 'done'))
      if (!data.campaignId) throw new Error('Campaign was saved but no ID was returned.')
      invalidateBillingInfo() // usage changed — next read must be fresh
      track('generate_succeeded', { ms: Date.now() - startedAt })
      toast.success('Campaign ready! Redirecting…')
      router.push(`/dashboard/campaigns/${data.campaignId}`)
    } catch (err) {
      clearInterval(timer)
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      track('generate_failed', { message: msg.slice(0, 80) })
      setError(msg)
      setStatus('error')
      toast.error(msg)
    }
  }

  const canSubmit = (!commercial || !!cre.useType) && !busy && !stillUploading && uploadedKeys.length >= 1 && !!form.address.trim() && !!form.city.trim() && form.state.trim().length === 2

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Generate Campaign</h1>
        <p className="text-sm text-slate-500 mt-1">{commercial
          ? 'Enter the property and add photos. We\u2019ll write the offering teaser, one-pager, LinkedIn and Facebook posts, a broker/investor email sequence, a one-sheet and a teaser page.'
          : 'Enter your listing details and add your photos — we\u2019ll build the full 6-week campaign.'}</p>
      </div>

      <div role="tablist" aria-label="Campaign type" className="inline-flex bg-slate-100 rounded-xl p-1">
        {(['residential', 'commercial'] as const).map(m => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={busy} onClick={() => setMode(m)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {m === 'residential' ? 'Residential' : 'Commercial'}
          </button>
        ))}
      </div>

      {showBrandKitPrompt && brandKitStatus && STARTER_TIERS.includes(brandKitStatus.planTier) && !brandKitStatus.brandKitComplete && (
        <BrandKitPrompt
          onDismiss={() => setShowBrandKitPrompt(false)}
          onProceed={() => { setShowBrandKitPrompt(false); void handleGenerate() }}
        />
      )}

      {/* 1. Address */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-500" /> Property address</h2>
        <div>
          <label className={labelCls}>Street address <span className="text-red-400">*</span></label>
          <input className={inputCls} value={form.address} onChange={set('address')} placeholder="905 Woodside Creek Ln" maxLength={120} disabled={busy} autoComplete="street-address" />
        </div>
        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-3"><label className={labelCls}>City <span className="text-red-400">*</span></label>
            <input className={inputCls} value={form.city} onChange={set('city')} maxLength={80} disabled={busy} /></div>
          <div className="col-span-1"><label className={labelCls}>State <span className="text-red-400">*</span></label>
            <input className={`${inputCls} uppercase`} value={form.state} onChange={set('state')} maxLength={2} placeholder="SC" disabled={busy} /></div>
          <div className="col-span-2"><label className={labelCls}>ZIP</label>
            <input className={inputCls} value={form.zip} onChange={set('zip')} maxLength={10} inputMode="numeric" disabled={busy} /></div>
        </div>
        {enrichEnabled && !commercial && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleEnrich} disabled={enriching || busy}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">
              {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
              Auto-fill from public records
            </button>
            <span className="text-xs text-slate-500">Optional — you can edit everything below.</span>
          </div>
        )}
        {enrichedFrom && !commercial && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Some details were filled from public records. Public records can be outdated — please verify beds, baths and square footage before generating.
          </p>
        )}
      </section>

      {/* 2. Details */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{commercial ? 'Property details' : 'Listing details'}</h2>
        {commercial && (
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Property type <span className="text-red-400">*</span></label>
              <select className={inputCls} value={cre.useType} onChange={setCreField('useType')} disabled={busy}>
                <option value="">Select…</option>
                {USE_TYPES.map(t => <option key={t} value={t}>{USE_TYPE_LABEL[t]}</option>)}
              </select></div>
            <div><label className={labelCls}>Offering</label>
              <select className={inputCls} value={cre.offering} onChange={setCreField('offering')} disabled={busy}>
                <option value="sale">For sale</option><option value="lease">For lease</option>
              </select></div>
            <div><label className={labelCls}>Building size (SF)</label>
              <input className={inputCls} value={form.sqft} onChange={set('sqft')} placeholder="42000" inputMode="numeric" disabled={busy} /></div>
            <div><label className={labelCls}>Units <span className="font-normal text-slate-400">(multifamily, hospitality)</span></label>
              <input className={inputCls} value={cre.units} onChange={setCreField('units')} inputMode="numeric" disabled={busy} /></div>
            <div><label className={labelCls}>Land (acres)</label>
              <input className={inputCls} value={cre.lotAcres} onChange={setCreField('lotAcres')} placeholder="2.4" inputMode="decimal" disabled={busy} /></div>
            <div><label className={labelCls}>{cre.offering === 'lease' ? 'Asking rent' : 'Asking price'} <span className="font-normal text-slate-400">(optional)</span></label>
              <input className={inputCls} value={form.price} onChange={set('price')} placeholder="3500000" inputMode="numeric" disabled={busy} /></div>
            <div className="col-span-2"><label className={labelCls}>Price guidance <span className="font-normal text-slate-400">(optional, shown as written)</span></label>
              <input className={inputCls} value={cre.priceGuidance} onChange={setCreField('priceGuidance')} placeholder="$18/SF NNN · Offers invited · Call for pricing" maxLength={120} disabled={busy} /></div>
            <div className="col-span-2 text-xs font-semibold text-slate-500 pt-1">Optional details. Leave blank and nothing is invented.</div>
            <div><label className={labelCls}>NOI (annual $)</label>
              <input className={inputCls} value={cre.noi} onChange={setCreField('noi')} inputMode="numeric" disabled={busy} /></div>
            <div><label className={labelCls}>Cap rate (%)</label>
              <input className={inputCls} value={cre.capRate} onChange={setCreField('capRate')} placeholder="7.1" inputMode="decimal" disabled={busy} /></div>
            <div><label className={labelCls}>Year built</label>
              <input className={inputCls} value={form.yearBuilt} onChange={set('yearBuilt')} inputMode="numeric" maxLength={4} disabled={busy} /></div>
            <div><label className={labelCls}>Zoning / permitted use</label>
              <input className={inputCls} value={cre.zoning} onChange={setCreField('zoning')} maxLength={80} disabled={busy} /></div>
            <div className="col-span-2"><label className={labelCls}>Occupancy / lease notes</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={cre.occupancy} onChange={setCreField('occupancy')} maxLength={600} disabled={busy} placeholder="e.g. 92% leased, anchor lease through 2031" /></div>
            <div className="col-span-2"><label className={labelCls}>Broker remarks</label>
              <textarea className={`${inputCls} resize-none`} rows={3} value={cre.brokerRemarks} onChange={setCreField('brokerRemarks')} maxLength={2000} disabled={busy} placeholder="Anything buyers' or tenants' brokers should know." /></div>
          </div>
        )}
        {!commercial && (
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>List price</label>
            <input className={inputCls} value={form.price} onChange={set('price')} placeholder="499000" inputMode="numeric" disabled={busy} /></div>
          <div><label className={labelCls}>Sq ft</label>
            <input className={inputCls} value={form.sqft} onChange={set('sqft')} placeholder="2400" inputMode="numeric" disabled={busy} /></div>
          <div><label className={labelCls}>Bedrooms</label>
            <input className={inputCls} value={form.bedrooms} onChange={set('bedrooms')} inputMode="numeric" disabled={busy} /></div>
          <div><label className={labelCls}>Bathrooms</label>
            <input className={inputCls} value={form.bathrooms} onChange={set('bathrooms')} placeholder="2.5" inputMode="decimal" disabled={busy} /></div>
          <div><label className={labelCls}>Year built</label>
            <input className={inputCls} value={form.yearBuilt} onChange={set('yearBuilt')} inputMode="numeric" maxLength={4} disabled={busy} /></div>
          <div><label className={labelCls}>Property type</label>
            <select className={inputCls} value={form.propertyType} onChange={set('propertyType')} disabled={busy}>
              <option value="">Select…</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
        </div>
        )}

        <div>
          <label className={labelCls}>Key features</label>
          <div className="flex gap-2">
            <input className={inputCls} value={featureInput} onChange={e => setFeatureInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
              placeholder="e.g. Quartz countertops — press Enter to add" maxLength={60} disabled={busy} />
            <button type="button" onClick={addFeature} disabled={busy} className="px-4 text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50">Add</button>
          </div>
          {features.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {features.map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs rounded-full pl-3 pr-2 py-1">
                  {f}
                  <button type="button" onClick={() => setFeatures(prev => prev.filter(x => x !== f))} disabled={busy} aria-label={`Remove ${f}`}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Description <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea className={`${inputCls} resize-none`} rows={4} value={form.description} onChange={set('description')} maxLength={4000} disabled={busy}
            placeholder={commercial ? 'Highlights in your own words: tenancy, access and frontage, building features, why it matters to a buyer or tenant…' : 'Describe the property — features, finishes, location highlights, anything that makes it special…'} />
          <p className="text-xs text-slate-500 mt-1.5">The more detail you provide, the better the campaign output.</p>
          {(() => {
            const hits = commercial && !['multifamily', 'mixed_use'].includes(cre.useType) ? [] : scanText(form.description)
            if (hits.length === 0) return null
            const fixable = hits.some(h => h.after !== null)
            return (
              <div role="status" className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <div className="font-semibold mb-1">Fair Housing check: {hits.length} phrase{hits.length === 1 ? '' : 's'} to review</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {hits.slice(0, 4).map((h, i) => <li key={i}>&ldquo;{h.match}&rdquo; — {h.message}</li>)}
                </ul>
                {fixable && (
                  <button type="button" className="mt-2 font-semibold underline" disabled={busy}
                    onClick={() => setForm(prev => ({ ...prev, description: applyRewrites(prev.description).text }))}>
                    Apply safe rewrites
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      </section>

      {/* 3. Photos */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Photos <span className="text-red-400">*</span></h2>
          <span className="text-xs text-slate-500">{uploadedKeys.length}/{MAX_PHOTOS} · add at least {RECOMMENDED_PHOTOS} for the best captions</span>
        </div>
        <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <input {...getInputProps()} />
          <ImagePlus className="w-7 h-7 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Drop your listing photos here, or click to browse</p>
          <p className="text-xs text-slate-500 mt-1">JPG, PNG or WebP. Lead with your best exterior and living-space shots. Only upload photos you have the right to use.</p>
        </div>
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photos.map((p, i) => {
              const aiRank = p.status === 'done' ? photos.slice(0, i).filter(x => x.status === 'done').length : -1
              return (
              <li
                key={p.id}
                draggable={!busy}
                onDragStart={() => setDragId(p.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragId) reorder(dragId, p.id); setDragId(null) }}
                onDragEnd={() => setDragId(null)}
                className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 border ${dragId === p.id ? 'border-amber-400 opacity-50' : 'border-slate-200'} ${busy ? '' : 'cursor-grab active:cursor-grabbing'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={`Listing photo ${i + 1}`} className="w-full h-full object-cover" />
                {aiRank >= 0 && aiRank < 4 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5">AI sees #{aiRank + 1}</span>}
                {!busy && (
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    <button type="button" onClick={() => nudge(p.id, -1)} disabled={i === 0} aria-label="Move photo earlier"
                      className="bg-white/90 hover:bg-white disabled:opacity-30 rounded-full p-1 shadow"><ChevronLeft className="w-3.5 h-3.5 text-slate-700" /></button>
                    <button type="button" onClick={() => nudge(p.id, 1)} disabled={i === photos.length - 1} aria-label="Move photo later"
                      className="bg-white/90 hover:bg-white disabled:opacity-30 rounded-full p-1 shadow"><ChevronRight className="w-3.5 h-3.5 text-slate-700" /></button>
                  </div>
                )}
                {p.status === 'uploading' && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>}
                {p.status === 'error' && <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center p-2 text-center text-[11px] text-red-700">{p.error}</div>}
                {p.status === 'done' && <span className="absolute top-1 left-1 bg-green-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></span>}
                <button type="button" onClick={() => removePhoto(p.id)} disabled={busy} aria-label="Remove photo"
                  className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full p-1 shadow"><Trash2 className="w-3.5 h-3.5 text-slate-600" /></button>
              </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-slate-500">Drag photos (or use the arrows) to reorder. The first 4 uploaded photos are analyzed by AI to write room-specific captions, so put your best exterior and living-space shots first.</p>
      </section>

      {/* Generate */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <button onClick={() => void handleGenerate()} disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold px-6 py-4 rounded-xl transition-all">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {busy ? 'Generating your campaign…' : 'Generate Campaign'}
        </button>
        {!canSubmit && !busy && (
          <p className="text-xs text-slate-500 text-center mt-3">
            {uploadedKeys.length < 1 ? 'Add at least one photo to continue.' : stillUploading ? 'Uploading photos…' : 'Fill in the address, city and state to continue.'}
          </p>
        )}
        {busy && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-end"><ElapsedTimer /></div>
            {steps.map(step => (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step.status === 'done' ? 'bg-green-500' : step.status === 'active' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  {step.status === 'done' && <Check className="w-3 h-3 text-white" />}
                  {step.status === 'active' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                </div>
                <span className={`text-sm ${step.status === 'active' ? 'text-slate-900 font-medium' : step.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-400'}`}>{step.label}</span>
                {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin ml-auto" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {status === 'error' && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3" role="alert">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">{error}</p>
            {error.toLowerCase().includes('limit') && (
              <Link href="/dashboard/billing" className="text-xs text-red-700 underline mt-1 inline-block">Upgrade your plan →</Link>
            )}
            <button onClick={() => setStatus('idle')} className="text-xs text-red-600 hover:text-red-800 mt-2 underline block">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )
}
