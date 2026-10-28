'use client'

import { getBillingInfo } from '@/lib/billing-client'
import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, Check, Palette, User, Globe,
  Mail, Lock, Zap, Save, Loader2, Image, Building2, MessageSquare, Plus, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { applyCompliance, lockedKeys, type LockableField, type OrgCompliance } from '@/lib/compliance/brand'
import { brandWarnings } from '@/lib/compliance/warnings'
import { resolveBrandAssetUrl } from '@/lib/brand-assets'

interface BrandKitForm {
  agentName: string; agentTitle: string; agentPhone: string
  agentEmail: string; agentWebsite: string; brokerageName: string
  tagline: string; disclaimer: string; primaryColor: string
  accentColor: string; fontFamily: string
  facebookUrl: string; instagramHandle: string; linkedinUrl: string
  tone: 'professional' | 'friendly' | 'luxury' | 'energetic'
  logoUrl: string; agentPhotoUrl: string; brokerageLogo: string
  licenseNumber: string
  extraColors: BrandColor[]
}

interface BrandColor { name: string; value: string }

const MAX_EXTRA_COLORS = 8
const SUGGESTED_COLOR_NAMES = ['Secondary', 'Tertiary', 'Neutral', 'Highlight', 'Background', 'Text', 'Link', 'Border']

/** Greys out a field the brokerage controls. */
function LockWrap({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  if (!locked) return <>{children}</>
  return (
    <div className="relative">
      <div className="opacity-60 pointer-events-none select-none" aria-disabled="true">{children}</div>
      <span className="absolute -top-2 right-0 inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-800 text-white rounded-full px-2 py-0.5"><Lock className="w-2.5 h-2.5" /> Set by your brokerage</span>
    </div>
  )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0.5 flex-shrink-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="#000000" />
      </div>
    </div>
  )
}

type ImageSlot = 'logo' | 'agentPhoto' | 'brokerageLogo'

function ImageUploadZone({ label, hint, currentUrl, slot, onUpload }: {
  label: string
  hint: string
  currentUrl: string
  slot: ImageSlot
  onUpload: (url: string) => void
}) {
  // Display URL: stored values (older R2 URLs included) are resolved to the same-origin /api/brand-assets path.
  const [preview, setPreview] = useState<string>(resolveBrandAssetUrl(currentUrl))
  const [uploading, setUploading] = useState(false)
  const [broken, setBroken] = useState(false)

  // The saved kit arrives after first render (and locked values can change): keep the preview in step with it.
  useEffect(() => {
    setPreview(resolveBrandAssetUrl(currentUrl))
    setBroken(false)
  }, [currentUrl])

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/brand-kit/upload?slot=${slot}`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()

      // R2 not configured in this environment — fall back to base64 data URL
      if (!res.ok && data?.error === 'R2_NOT_CONFIGURED') {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string
            setPreview(dataUrl); setBroken(false)
            onUpload(dataUrl)
            resolve()
          }
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })
        toast.success('Image ready (local preview)')
        return
      }

      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`)

      setPreview(resolveBrandAssetUrl(data.url)); setBroken(false)
      onUpload(data.url)
      toast.success('Image uploaded!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }, [slot, onUpload])

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors[0]?.message ?? 'Invalid file'
      toast.error(reason)
    },
  })

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <div className="flex items-center gap-4">
            {broken ? (
              <div className="w-16 h-16 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center leading-tight px-1">No preview</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={preview} src={preview} alt={`${label} preview`} onError={() => setBroken(true)} className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-white" />
            )}
            <div className="text-left min-w-0">
              {broken ? (
                <p className="text-xs font-semibold text-amber-700">Preview unavailable</p>
              ) : (
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1"><Check className="w-3 h-3" /> Uploaded</p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">{broken ? 'Click or drag to upload it again' : 'Click or drag to replace'}</p>
            </div>
          </div>
        ) : (
          <div>
            {uploading
              ? <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
              : <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            }
            <p className="text-xs font-medium text-slate-700">
              {uploading ? 'Uploading…' : 'Drop file or click to upload'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{hint}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FormField({ label, type = 'text', value, onChange, placeholder, prefix }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="flex">
        {prefix && <span className="flex-shrink-0 flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg text-sm text-slate-500">{prefix}</span>}
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 bg-slate-50 border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all ${prefix ? 'rounded-r-lg' : 'rounded-lg'}`}
        />
      </div>
    </div>
  )
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', desc: 'Authoritative, data-driven, formal' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm, conversational, approachable' },
  { value: 'luxury', label: 'Luxury', desc: 'Elevated, aspirational, refined' },
  { value: 'energetic', label: 'Energetic', desc: 'Enthusiastic, high-energy, compelling' },
] as const

export default function BrandPage() {
  const [form, setForm] = useState<BrandKitForm>({
    agentName: '', agentTitle: 'REALTOR®', agentPhone: '', agentEmail: '',
    agentWebsite: '', brokerageName: '', tagline: '', disclaimer: '',
    primaryColor: '#1e293b', accentColor: '#f59e0b', fontFamily: 'Georgia',
    facebookUrl: '', instagramHandle: '', linkedinUrl: '',
    tone: 'professional', logoUrl: '', agentPhotoUrl: '', brokerageLogo: '', licenseNumber: '', extraColors: [],
  })
  const [compliance, setCompliance] = useState<OrgCompliance | null>(null)
  const [saving, setSaving] = useState(false)
  const [planTier, setPlanTier] = useState<string>('free')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  const set = (key: keyof BrandKitForm) => (val: string) => setForm(prev => ({ ...prev, [key]: val }))
  const addColor = () => setForm(prev => {
    if (prev.extraColors.length >= MAX_EXTRA_COLORS) return prev
    const used = new Set(prev.extraColors.map(c => c.name))
    const name = SUGGESTED_COLOR_NAMES.find(n => !used.has(n)) ?? `Color ${prev.extraColors.length + 3}`
    return { ...prev, extraColors: [...prev.extraColors, { name, value: '#64748b' }] }
  })
  const locked = new Set<LockableField>(lockedKeys(compliance))
  const isLocked = (k: LockableField) => locked.has(k)
  // What outputs will actually use (locks + forced disclaimer applied) — drives the warnings.
  const effective = applyCompliance(form, compliance, form.licenseNumber)
  const warnings = brandWarnings(effective, { licenseNumber: form.licenseNumber })

  useEffect(() => {
    const fetchBrandKit = async () => {
      try {
        const [bkRes, info] = await Promise.all([
          fetch('/api/brand-kit'),
          getBillingInfo(),
        ])
        const { brandKit, licenseNumber, compliance: org } = await bkRes.json()
        setCompliance(org ?? null)
        const planTier = info?.planTier ?? 'free'
        setPlanTier(planTier)
        setForm(prev => ({ ...prev, licenseNumber: licenseNumber ?? '' }))
        if (brandKit) {
          setForm(prev => ({
            ...prev,
            agentName: brandKit.agentName ?? '',
            agentTitle: brandKit.agentTitle ?? 'REALTOR®',
            agentPhone: brandKit.agentPhone ?? '',
            agentEmail: brandKit.agentEmail ?? '',
            agentWebsite: brandKit.agentWebsite ?? '',
            brokerageName: brandKit.brokerageName ?? '',
            tagline: brandKit.tagline ?? '',
            disclaimer: brandKit.disclaimer ?? '',
            primaryColor: brandKit.primaryColor ?? '#1e293b',
            accentColor: brandKit.accentColor ?? '#f59e0b',
            fontFamily: brandKit.fontFamily ?? 'Georgia',
            facebookUrl: brandKit.facebookUrl ?? '',
            instagramHandle: brandKit.instagramHandle ?? '',
            linkedinUrl: brandKit.linkedinUrl ?? '',
            logoUrl: brandKit.logoUrl ?? '',
            agentPhotoUrl: brandKit.agentPhotoUrl ?? '',
            brokerageLogo: brandKit.brokerageLogo ?? '',
            tone: brandKit.aiPersona?.tone ?? brandKit.tone ?? 'professional',
            extraColors: Array.isArray(brandKit.extraColors) ? brandKit.extraColors : [],
          }))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchBrandKit()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          // Only complete colors are saved: a valid #rrggbb value and a name (blank names fall back to "Color").
          extraColors: form.extraColors
            .filter(c => /^#[0-9a-fA-F]{6}$/.test(c.value))
            .map(c => ({ name: c.name.trim() || 'Color', value: c.value })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      // Sync form tone from the saved record so the highlight always reflects DB state
      if (data.brandKit) {
        const savedTone = data.brandKit.aiPersona?.tone ?? data.brandKit.tone ?? form.tone
        setForm(prev => ({ ...prev, tone: savedTone }))
      }
      setSaved(true)
      toast.success('Brand kit saved! It will be applied to all future campaigns.')
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save brand kit')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (planTier === 'free') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-amber-700" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-slate-900 mb-3">Brand Kit — Starter+ Feature</h2>
          <p className="text-slate-600 mb-2 leading-relaxed">
            Upload your logo, headshot, brand colors, and contact info once. ListOps will automatically apply your brand to every flyer, email, and piece of content you generate.
          </p>
          <p className="text-sm text-slate-500 mb-8">
            Your branding is the #1 thing that separates your marketing from generic content. Set it once, benefit forever.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 mb-8 text-left">
            {[
              { icon: '🎨', title: 'Colors & Fonts', desc: 'Your brand colors applied to every flyer and email' },
              { icon: '📸', title: 'Agent Photo', desc: 'Your headshot automatically added to all materials' },
              { icon: '🏢', title: 'Brokerage Logo', desc: 'Both your personal and brokerage brands in one' },
            ].map(item => (
              <div key={item.title} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xl mb-2">{item.icon}</div>
                <div className="font-semibold text-slate-900 text-sm mb-1">{item.title}</div>
                <div className="text-xs text-slate-500">{item.desc}</div>
              </div>
            ))}
          </div>
          <Link href="/dashboard/billing?plan=starter" className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-800 transition-colors">
            <Zap className="w-4 h-4 text-amber-400" />
            Upgrade to Starter — $29/mo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Brand Kit</h1>
          <p className="text-sm text-slate-500 mt-1">Set once. Applied to every campaign automatically.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-amber-400" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Brand Kit'}
        </button>
      </div>

      {warnings.length > 0 && (
        <div role="status" className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="font-semibold text-amber-900 text-sm mb-2">Finish your brand kit ({warnings.length} item{warnings.length === 1 ? '' : 's'})</div>
          <ul className="space-y-1.5 text-sm text-amber-900">
            {warnings.map(w => (
              <li key={w.id}><span className={`inline-block text-[10px] font-bold uppercase rounded px-1.5 py-0.5 mr-2 ${w.level === 'required' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{w.level}</span><strong>{w.message}.</strong> <span className="text-amber-800">{w.fix}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Agent Identity */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Agent Identity</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Full Name" value={form.agentName} onChange={set('agentName')} placeholder="Sarah Mitchell" />
          <FormField label="Professional Title" value={form.agentTitle} onChange={set('agentTitle')} placeholder="REALTOR®" />
          <FormField label="Phone" type="tel" value={form.agentPhone} onChange={set('agentPhone')} placeholder="(512) 555-0100" />
          <FormField label="Email" type="email" value={form.agentEmail} onChange={set('agentEmail')} placeholder="sarah@reedrealty.com" />
          <div className="sm:col-span-2">
            <FormField label="Website" type="text" value={form.agentWebsite} onChange={set('agentWebsite')} placeholder="https://sarahmitchell.com" />
          </div>
          <LockWrap locked={isLocked('brokerageName')}>
            <FormField label="Brokerage Name" value={isLocked('brokerageName') ? effective.brokerageName : form.brokerageName} onChange={set('brokerageName')} placeholder="Reed Realty Group" />
          </LockWrap>
          <FormField label="License Number" value={form.licenseNumber} onChange={set('licenseNumber')} placeholder="e.g. 123456" />
          <div className="sm:col-span-2">
            <LockWrap locked={isLocked('tagline')}>
              <FormField label="Tagline" value={isLocked('tagline') ? effective.tagline : form.tagline} onChange={set('tagline')} placeholder="Your Trusted Austin Area Real Estate Expert" />
            </LockWrap>
          </div>
        </div>
      </div>

      {/* Photos & Logos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Image className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Photos & Logos</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          <ImageUploadZone label="Agent Headshot"   hint="PNG, JPG, WebP • Max 5MB" currentUrl={form.agentPhotoUrl} slot="agentPhoto"    onUpload={set('agentPhotoUrl')} />
          <LockWrap locked={isLocked('logoUrl')}>
            <ImageUploadZone label="Agent/Team Logo"  hint="PNG, SVG recommended"     currentUrl={isLocked('logoUrl') ? effective.logoUrl : form.logoUrl}       slot="logo"         onUpload={set('logoUrl')} />
          </LockWrap>
          <LockWrap locked={isLocked('brokerageLogo')}>
            <ImageUploadZone label="Brokerage Logo"   hint="PNG, SVG recommended"     currentUrl={isLocked('brokerageLogo') ? effective.brokerageLogo : form.brokerageLogo} slot="brokerageLogo" onUpload={set('brokerageLogo')} />
          </LockWrap>
        </div>
      </div>

      {/* Brand Colors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Palette className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Brand Colors</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <LockWrap locked={isLocked('primaryColor')}><ColorPicker label="Primary Color" value={isLocked('primaryColor') ? effective.primaryColor : form.primaryColor} onChange={set('primaryColor')} /></LockWrap>
          <LockWrap locked={isLocked('accentColor')}><ColorPicker label="Accent Color" value={isLocked('accentColor') ? effective.accentColor : form.accentColor} onChange={set('accentColor')} /></LockWrap>
        </div>
        {/* Additional named colors */}
        {form.extraColors.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-5 mb-5">
            {form.extraColors.map((c, i) => (
              <div key={i} className="relative">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <input
                    value={c.name}
                    maxLength={30}
                    aria-label={`Name for color ${i + 3}`}
                    onChange={e => setForm(prev => ({ ...prev, extraColors: prev.extraColors.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))}
                    className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-600 border-b border-dashed border-slate-300 focus:outline-none focus:border-amber-400 py-0.5"
                  />
                  <button type="button" aria-label={`Remove ${c.name || 'color'}`} onClick={() => setForm(prev => ({ ...prev, extraColors: prev.extraColors.filter((_, j) => j !== i) }))}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={c.value} aria-label={`${c.name || 'Color'} picker`}
                    onChange={e => setForm(prev => ({ ...prev, extraColors: prev.extraColors.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0.5 flex-shrink-0" />
                  <input type="text" value={c.value} maxLength={7}
                    onChange={e => setForm(prev => ({ ...prev, extraColors: prev.extraColors.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="#000000" />
                </div>
              </div>
            ))}
          </div>
        )}
        {form.extraColors.length < MAX_EXTRA_COLORS && (
          <button type="button" onClick={addColor}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 border border-dashed border-amber-300 hover:border-amber-400 rounded-lg px-3 py-2 transition-colors">
            <Plus className="w-4 h-4" /> Add another color
          </button>
        )}

        {/* Color Preview */}
        {form.extraColors.length > 0 && (
          <div className="flex h-8 rounded-lg overflow-hidden border border-slate-200 mb-3" aria-label="Your palette">
            {[{ name: 'Primary', value: form.primaryColor }, { name: 'Accent', value: form.accentColor }, ...form.extraColors].map((c, i) => (
              <div key={i} title={`${c.name}: ${c.value}`} style={{ backgroundColor: c.value }} className="flex-1" />
            ))}
          </div>
        )}
        <div className="rounded-xl overflow-hidden border border-slate-200">
          <div style={{ backgroundColor: form.primaryColor }} className="p-4">
            <p style={{ color: form.accentColor }} className="text-xs font-bold uppercase tracking-widest mb-1">Preview</p>
            <p className="text-white font-display text-lg font-semibold">123 Oak Street, Austin TX</p>
            <p style={{ color: form.accentColor }} className="text-sm font-semibold">$485,000 · 3 bed · 2 bath</p>
          </div>
          <div className="bg-white p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900 text-sm">{form.agentName || 'Your Name'}</p>
              <p className="text-xs text-slate-500">{form.agentTitle}</p>
            </div>
            <div style={{ backgroundColor: form.accentColor, borderRadius: '8px', padding: '6px 14px' }}>
              <span className="text-xs font-bold" style={{ color: form.primaryColor }}>Contact</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Writing Persona */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">AI Writing Persona</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">Claude will write every campaign in this style.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TONE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setForm(prev => ({ ...prev, tone: opt.value }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${form.tone === opt.value ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="font-semibold text-slate-900 text-sm mb-0.5">{opt.label}</div>
              <div className="text-xs text-slate-500 leading-tight">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Social Media */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Social Media</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <FormField label="Facebook Page URL" value={form.facebookUrl} onChange={set('facebookUrl')} placeholder="https://facebook.com/yourpage" />
          <FormField label="Instagram Handle" value={form.instagramHandle} onChange={set('instagramHandle')} placeholder="@sarahmitchellrealty" prefix="@" />
          <FormField label="LinkedIn URL" value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/yourname" />
        </div>
      </div>

      {/* Legal Disclaimer */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Legal Disclaimer</h2>
          <span className="text-xs text-slate-400">(Optional — added to print materials)</span>
        </div>
        <textarea
          value={form.disclaimer}
          onChange={e => setForm(prev => ({ ...prev, disclaimer: e.target.value }))}
          placeholder="Information deemed reliable but not guaranteed. Licensed REALTOR® in Texas. Equal Housing Opportunity."
          rows={3}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
        />
        {compliance && effective.disclaimer !== form.disclaimer && (
          <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-3"><span className="font-semibold">Your brokerage adds this to every piece:</span> {effective.disclaimer}</p>
        )}
      </div>

      {/* Save button bottom */}
      <div className="flex justify-end pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-8 py-3 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-amber-400" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Brand Kit'}
        </button>
      </div>
    </div>
  )
}
