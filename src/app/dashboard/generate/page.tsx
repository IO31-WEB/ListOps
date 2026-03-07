'use client'

import { useState } from 'react'
import { Zap, ArrowRight, Copy, Check, ChevronDown, ChevronUp, AlertTriangle, Loader2, Facebook, Instagram, Mail, Printer, Video, Music } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

type GenStatus = 'idle' | 'generating' | 'complete' | 'error'
interface GenStep { id: string; label: string; status: 'pending' | 'active' | 'done' }
interface ReelScript {
  week: number
  title: string
  duration: string
  hook: string
  script: string
  captions: string[]
  music: string
}

interface CampaignResult {
  campaignId?: string
  isDemo?: boolean
  planTier?: string
  brandKit?: { logoUrl?: string; brokerageLogo?: string; agentPhotoUrl?: string } | null
  listing: { address: string; price: string; beds: number; baths: number; sqft: number; photos?: string[]; description?: string }
  facebook: Array<{ week: number; theme: string; copy: string; hashtags?: string[] }>
  instagram: Array<{ week: number; caption: string; hashtags: string[] }>
  emailJustListed: string
  emailStillAvailable: string
  reelScripts?: ReelScript[] | null
  generationMs?: number
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {label || (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}

function Section({ title, icon: Icon, badge, children }: { title: string; icon: React.ComponentType<any>; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center"><Icon className="w-4 h-4 text-amber-700" /></div>
          <span className="font-display font-semibold text-slate-900">{title}</span>
          {badge && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

const STEPS: GenStep[] = [
  { id: 'mls', label: 'Connecting to MLS & fetching listing data', status: 'pending' },
  { id: 'facebook', label: 'Writing 6-week Facebook calendar', status: 'pending' },
  { id: 'instagram', label: 'Writing 6-week Instagram captions', status: 'pending' },
  { id: 'email', label: 'Writing email copy (Just Listed + Still Available)', status: 'pending' },
  { id: 'saving', label: 'Saving campaign to your account', status: 'pending' },
]

export default function GeneratePage() {
  const [mlsId, setMlsId] = useState('')
  const [status, setStatus] = useState<GenStatus>('idle')
  const [steps, setSteps] = useState<GenStep[]>(STEPS)
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [error, setError] = useState('')
  const [genTime, setGenTime] = useState(0)

  const updateStep = (id: string, s: GenStep['status']) =>
    setSteps(prev => prev.map(step => step.id === id ? { ...step, status: s } : step))

  const handleGenerate = async () => {
    const trimmed = mlsId.trim()
    if (!trimmed) { toast.error('Please enter an MLS listing ID'); return }

    setStatus('generating')
    setError('')
    setResult(null)
    setSteps(STEPS.map(s => ({ ...s, status: 'pending' })))

    const startTime = Date.now()

    // Animate steps while waiting for the API
    updateStep('mls', 'active')
    const stepIds = ['mls', 'facebook', 'instagram', 'email', 'saving']
    let stepIdx = 0
    const timer = setInterval(() => {
      if (stepIdx < stepIds.length - 1) {
        updateStep(stepIds[stepIdx], 'done')
        stepIdx++
        updateStep(stepIds[stepIdx], 'active')
      }
    }, 11000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mlsId: trimmed }),
      })

      clearInterval(timer)

      // Mark all steps done
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

      const elapsed = Math.round((Date.now() - startTime) / 1000)
      setGenTime(elapsed)
      setResult(data)
      setStatus('complete')
      toast.success(`Campaign ready in ${elapsed}s! 🎉`)

    } catch (err: any) {
      clearInterval(timer)
      const msg = err.message || 'Something went wrong. Please try again.'
      setError(msg)
      setStatus('error')
      toast.error(msg)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
              onKeyDown={e => e.key === 'Enter' && (status === 'idle' || status === 'error') && handleGenerate()}
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
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                : <><Zap className="w-4 h-4 text-amber-400" /> Generate Campaign</>
              }
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Connected via SimplyRETS MLS API • Supports 500+ MLS boards nationwide
          </p>
        </div>

        {/* Progress steps */}
        {status === 'generating' && (
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Generating Your Campaign</p>
              <span className="text-xs text-slate-500 animate-pulse">~60 seconds</span>
            </div>
            {steps.map(step => (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  step.status === 'done' ? 'bg-green-500' :
                  step.status === 'active' ? 'bg-amber-400' : 'bg-slate-200'
                }`}>
                  {step.status === 'done' ? <Check className="w-3 h-3 text-white" /> :
                   step.status === 'active' ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> :
                   <div className="w-2 h-2 bg-slate-400 rounded-full" />}
                </div>
                <span className={`text-sm transition-all ${
                  step.status === 'active' ? 'text-slate-900 font-semibold' :
                  step.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-400'
                }`}>{step.label}</span>
                {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin ml-auto" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {status === 'error' && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">{error}</p>
            {error.includes('limit') && (
              <Link href="/dashboard/billing" className="text-xs text-red-700 underline mt-1 inline-block">
                Upgrade your plan →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {status === 'complete' && result && (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-900">
                  Campaign generated in {genTime}s!
                  {result.isDemo && <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Demo listing data</span>}
                </p>
                <p className="text-xs text-green-700">{result.listing.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {result.campaignId && (
                <Link href={`/dashboard/campaigns/${result.campaignId}`} className="text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors">
                  View Campaign →
                </Link>
              )}
              <button onClick={() => { setStatus('idle'); setMlsId(''); setResult(null) }} className="text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
                New Campaign
              </button>
            </div>
          </div>

          {/* Listing summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap gap-6 items-start">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Address</p>
              <p className="font-semibold text-slate-900">{result.listing.address}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Price</p>
              <p className="font-semibold text-slate-900">{result.listing.price}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Details</p>
              <p className="font-semibold text-slate-900">{result.listing.beds}bd · {result.listing.baths}ba · {result.listing.sqft?.toLocaleString()} sqft</p>
            </div>
          </div>

          {/* Property Photos */}
          {result.listing.photos && result.listing.photos.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="font-display font-semibold text-slate-900 text-sm">Property Photos</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{result.listing.photos.length} photos</span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {result.listing.photos.slice(0, 6).map((photo, i) => (
                  <a key={i} href={photo} target="_blank" rel="noopener noreferrer" className="aspect-video rounded-xl overflow-hidden bg-slate-100 block hover:opacity-90 transition-opacity">
                    <img src={photo} alt={`Property photo ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Facebook */}
          <Section title="Facebook Posts" icon={Facebook} badge={`${result.facebook?.length ?? 0} posts`}>
            <div className="divide-y divide-slate-100">
              {result.facebook?.map((post, i) => (
                <div key={i} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Week {post.week}</span>
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">{post.theme}</span>
                    </div>
                    <CopyButton text={post.copy} />
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.copy}</p>
                  {post.hashtags && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {post.hashtags.map((tag, j) => <span key={j} className="text-xs text-blue-600">#{tag.replace('#', '')}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <CopyButton text={result.facebook?.map(p => `Week ${p.week} — ${p.theme}\n\n${p.copy}`).join('\n\n---\n\n') ?? ''} label="Copy All 6 Posts" />
            </div>
          </Section>

          {/* Instagram */}
          <Section title="Instagram Captions" icon={Instagram} badge={`${result.instagram?.length ?? 0} posts`}>
            <div className="divide-y divide-slate-100">
              {result.instagram?.map((post, i) => (
                <div key={i} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Week {post.week}</span>
                    <CopyButton text={`${post.caption}\n\n${post.hashtags?.join(' ')}`} />
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {post.hashtags?.map((tag, j) => <span key={j} className="text-xs text-blue-600">{tag.startsWith('#') ? tag : `#${tag}`}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <CopyButton text={result.instagram?.map(p => `${p.caption}\n\n${p.hashtags?.join(' ')}`).join('\n\n---\n\n') ?? ''} label="Copy All 6 Captions" />
            </div>
          </Section>

          {/* Emails */}
          <Section title="Email Copy" icon={Mail} badge="2 templates">
            <div className="divide-y divide-slate-100">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-slate-900">Just Listed Email</span>
                  <CopyButton text={result.emailJustListed} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif border border-slate-100">
                  {result.emailJustListed}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-slate-900">Still Available Email</span>
                  <CopyButton text={result.emailStillAvailable} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif border border-slate-100">
                  {result.emailStillAvailable}
                </div>
              </div>
            </div>
          </Section>

          {/* Reel Scripts — Pro+ only */}
          {result.reelScripts && result.reelScripts.length > 0 ? (
            <Section title="Video & Reel Scripts" icon={Video} badge={`${result.reelScripts.length} scripts`}>
              <div className="divide-y divide-slate-100">
                {result.reelScripts.map((reel, i) => (
                  <div key={i} className="p-5 space-y-4">
                    {/* Week header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Week {reel.week}</span>
                        <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">{reel.title}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{reel.duration}</span>
                      </div>
                      <CopyButton text={`HOOK:\n${reel.hook}\n\nSCRIPT:\n${reel.script}\n\nON-SCREEN TEXT:\n${reel.captions?.join('\n')}\n\nMUSIC: ${reel.music}`} label="Copy Script" />
                    </div>

                    {/* Hook */}
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1.5">🎬 Opening Hook</p>
                      <p className="text-sm text-slate-800 font-semibold leading-relaxed">&ldquo;{reel.hook}&rdquo;</p>
                    </div>

                    {/* Script */}
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Script</p>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">{reel.script}</p>
                    </div>

                    {/* Captions + Music row */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {reel.captions && reel.captions.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">On-Screen Text</p>
                          <div className="space-y-1">
                            {reel.captions.map((cap, j) => (
                              <div key={j} className="flex items-center gap-2">
                                <span className="w-4 h-4 bg-slate-200 rounded text-xs flex items-center justify-center text-slate-600 flex-shrink-0">{j + 1}</span>
                                <span className="text-xs text-slate-700">{cap}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {reel.music && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Music className="w-3 h-3" /> Music Vibe
                          </p>
                          <p className="text-sm text-slate-700">{reel.music}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <CopyButton
                  text={result.reelScripts.map(r =>
                    `WEEK ${r.week} — ${r.title} (${r.duration})\n\nHOOK: "${r.hook}"\n\nSCRIPT:\n${r.script}\n\nON-SCREEN TEXT:\n${r.captions?.join('\n')}\n\nMUSIC: ${r.music}`
                  ).join('\n\n' + '─'.repeat(40) + '\n\n')}
                  label="Copy All 6 Scripts"
                />
              </div>
            </Section>
          ) : result.reelScripts === null && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden opacity-75">
              <div className="p-5 flex items-center gap-4">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-slate-400">Video &amp; Reel Scripts</span>
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pro+</span>
                  </div>
                  <p className="text-xs text-slate-400">6 word-for-word Reel &amp; TikTok scripts, one per week. Regenerate after upgrading.</p>
                </div>
                <Link href="/dashboard/billing" className="flex-shrink-0 text-xs font-semibold bg-slate-900 text-amber-400 px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap">
                  Upgrade to Pro →
                </Link>
              </div>
            </div>
          )}

          {/* Flyer */}
          <Section title="Print-Ready Flyer" icon={Printer} badge="PDF">
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1">Listing Flyer</p>
                <p className="text-xs text-slate-500">Opens a print-ready page — use your browser&apos;s Print → Save as PDF to download.</p>
              </div>
              {result.campaignId ? (
                <a
                  href={`/dashboard/campaigns/${result.campaignId}/flyer`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors flex-shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  Generate Flyer
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">Save campaign first</span>
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
