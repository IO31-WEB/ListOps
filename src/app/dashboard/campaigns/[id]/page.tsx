'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Copy, Check, Download, Share2, ExternalLink,
  Facebook, Instagram, Mail, Printer, ChevronDown, ChevronUp,
  Zap, Eye, Globe, Lock, Loader2, Video, Music, FileText,
  Hash, Linkedin, Twitter, Image, MapPin, Camera, Play, Mic,
  Globe2, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────

interface ReelScript {
  week: number; title: string; duration: string
  hook: string; script: string; captions: string[]; music: string
}
interface VirtualTourScript { type: string; duration: string; script: string }
interface TikTokPost { week: number; hook: string; script: string; trendingAudio: string; onScreenText: string[] }
interface LinkedInPost { week: number; post: string; hashtags: string[] }
interface XThread { week: number; tweets: string[] }
interface StoriesSlide { slideNumber: number; text: string; cta: string | null }
interface StoriesPost { week: number; platform: string; slides: StoriesSlide[] }
interface PhotoCaption {
  photoIndex: number; room: string; altText: string
  instagramCaption: string; overlayText: string; stagingNote: string
}

interface Campaign {
  id: string; status: string; createdAt: string; generationMs?: number
  micrositeSlug?: string; micrositePublished?: boolean; micrositeViews?: number
  facebookPosts?: Array<{ week: number; theme: string; copy: string; hashtags?: string[] }>
  instagramPosts?: Array<{ week: number; caption: string; hashtags: string[] }>
  emailJustListed?: string; emailStillAvailable?: string
  flyerUrl?: string; videoScript?: string
  listingCopy?: {
    headline: string; headlineVariations: string[]; fullDescription: string
    bulletPoints: string[]; neighborhoodStory: string; seoMetaTitle: string
    seoMetaDescription: string; spanishDescription: string
    toneVariants: { luxury: string; firstTimeBuyer: string; investor: string }
  }
  emailDrip?: {
    sellerUpdate: string; buyerDripDay1: string; buyerDripDay7: string
    buyerDripDay14: string; buyerDripDay30: string; openHouseInvite: string
    postShowingFeedback: string; marketReport: string
  }
  printMaterials?: {
    yardSignRider: string; postcardHeadline: string; postcardBody: string
    openHouseSignIn: string; brochureCopy: string; magazineAd: string
  }
  photoCaptions?: PhotoCaption[]
  micrositeCopy?: {
    heroHeadline: string; heroSubheadline: string; aboutHeading: string
    aboutBody: string; neighborhoodHeading: string; neighborhoodBody: string
    ctaHeading: string; ctaSubtext: string; photoCaptionTemplate: string
  }
  tiktok?: TikTokPost[]; linkedin?: LinkedInPost[]; xThreads?: XThread[]
  stories?: StoriesPost[]
  hashtagPacks?: { justListed: string[]; luxury: string[]; openHouse: string[]; postingSchedule: string }
  reelScripts?: ReelScript[]; virtualTourScripts?: VirtualTourScript[]
  listing?: {
    address?: string; city?: string; state?: string; price?: string
    bedrooms?: number; bathrooms?: string; sqft?: number; photos?: string[]
    description?: string
  }
  brandKit?: {
    agentName?: string; logoUrl?: string; brokerageLogo?: string
  }
}

// ── Shared micro-components ────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true); toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all flex-shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {label || (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}

type AccentColor = 'amber' | 'purple' | 'blue' | 'green' | 'rose' | 'indigo' | 'slate'
const ACCENT_CLASSES: Record<AccentColor, string> = {
  amber:  'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  rose:   'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  slate:  'bg-slate-100 text-slate-700',
}

function Section({ title, badge, icon: Icon, accent = 'amber', defaultOpen = false, children }: {
  title: string; badge?: string; icon: React.ComponentType<{ className?: string }>
  accent?: AccentColor; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ACCENT_CLASSES[accent]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display font-semibold text-slate-900">{title}</span>
            {badge && <span className="ml-2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

function LockedSection({ title, icon: Icon, plan, description }: {
  title: string; icon: React.ComponentType<{ className?: string }>; plan: string; description: string
}) {
  return (
    <Section title={title} badge={plan} icon={Icon} accent="purple">
      <div className="p-8 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
          <Lock className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 mb-1">{title} — {plan} Plan</p>
          <p className="text-sm text-slate-500 max-w-sm">{description}</p>
        </div>
        <Link href="/dashboard/billing" className="inline-flex items-center gap-2 bg-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-purple-700 transition-colors">
          <Zap className="w-4 h-4" /> Upgrade to {plan}
        </Link>
      </div>
    </Section>
  )
}

function WeekPill({ week }: { week: number }) {
  return <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Week {week}</span>
}

// ── Section 1: Listing Copy ────────────────────────────────────

function ListingCopySection({ data }: { data: NonNullable<Campaign['listingCopy']> }) {
  const [activeTone, setActiveTone] = useState<'luxury' | 'firstTimeBuyer' | 'investor' | null>(null)
  const tones = [
    { key: 'luxury' as const, label: 'Luxury', cls: 'bg-amber-100 text-amber-800' },
    { key: 'firstTimeBuyer' as const, label: 'First-Time Buyer', cls: 'bg-green-100 text-green-800' },
    { key: 'investor' as const, label: 'Investor', cls: 'bg-blue-100 text-blue-800' },
  ]
  return (
    <Section title="Listing Copy" badge="Full Package" icon={FileText} accent="amber" defaultOpen>
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Headline</span>
          <CopyButton text={data.headline} />
        </div>
        <p className="text-xl font-display font-semibold text-slate-900">{data.headline}</p>
      </div>
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">10 Headline Variations</span>
          <CopyButton text={data.headlineVariations.join('\n')} label="Copy All" />
        </div>
        <div className="space-y-2">
          {data.headlineVariations.map((h, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-slate-100 rounded text-xs flex items-center justify-center text-slate-400 flex-shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-sm text-slate-700 flex-1">{h}</p>
              <CopyButton text={h} />
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full MLS Description</span>
          <CopyButton text={data.fullDescription} />
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100 font-serif">{data.fullDescription}</div>
      </div>
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buyer Appeal Bullets</span>
          <CopyButton text={data.bulletPoints.join('\n')} label="Copy All" />
        </div>
        <div className="space-y-2">
          {data.bulletPoints.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-amber-500 mt-1 flex-shrink-0">✦</span>
              <p className="text-sm text-slate-700">{b}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Neighborhood Story</span>
          <CopyButton text={data.neighborhoodStory} />
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed border border-blue-100">
          <MapPin className="w-3.5 h-3.5 text-blue-500 inline mr-1.5 mb-0.5" />{data.neighborhoodStory}
        </div>
      </div>
      <div className="p-5 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">SEO Meta</span>
        <div className="space-y-3">
          {[
            { label: `Title (${data.seoMetaTitle.length} chars)`, content: data.seoMetaTitle, big: true },
            { label: `Description (${data.seoMetaDescription.length} chars)`, content: data.seoMetaDescription },
          ].map((item, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">{item.label}</span>
                <CopyButton text={item.content} />
              </div>
              <p className={`text-slate-800 ${item.big ? 'text-sm font-semibold' : 'text-sm'}`}>{item.content}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">Tone Variants</span>
        <div className="flex gap-2 mb-3 flex-wrap">
          {tones.map(t => (
            <button key={t.key} onClick={() => setActiveTone(activeTone === t.key ? null : t.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${activeTone === t.key ? t.cls + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {activeTone && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">{activeTone === 'firstTimeBuyer' ? 'First-Time Buyer' : activeTone} angle</span>
              <CopyButton text={data.toneVariants[activeTone]} />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{data.toneVariants[activeTone]}</p>
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spanish Version</span>
          <CopyButton text={data.spanishDescription} />
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-amber-100">{data.spanishDescription}</div>
      </div>
    </Section>
  )
}

// ── Section 2: Social Calendar ─────────────────────────────────

type SocialTab = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'x' | 'stories' | 'hashtags'

function SocialCalendarSection({ campaign, isPro }: { campaign: Campaign; isPro: boolean }) {
  const [tab, setTab] = useState<SocialTab>('facebook')
  const fbPosts = campaign.facebookPosts ?? []
  const igPosts = campaign.instagramPosts ?? []
  const tiktokPosts = campaign.tiktok ?? []
  const liPosts = campaign.linkedin ?? []
  const xPosts = campaign.xThreads ?? []
  const storiesPosts = campaign.stories ?? []
  const hashtagPacks = campaign.hashtagPacks

  const tabs = [
    { key: 'facebook' as SocialTab, label: 'Facebook', icon: Facebook, proOnly: false },
    { key: 'instagram' as SocialTab, label: 'Instagram', icon: Instagram, proOnly: false },
    { key: 'tiktok' as SocialTab, label: 'TikTok', icon: Play, proOnly: true },
    { key: 'linkedin' as SocialTab, label: 'LinkedIn', icon: Linkedin, proOnly: true },
    { key: 'x' as SocialTab, label: 'X', icon: Twitter, proOnly: true },
    { key: 'stories' as SocialTab, label: 'Stories', icon: Zap, proOnly: true },
    { key: 'hashtags' as SocialTab, label: 'Hashtags', icon: Hash, proOnly: false },
  ]

  const totalPosts = fbPosts.length + igPosts.length + (isPro ? tiktokPosts.length + liPosts.length + xPosts.length : 0)

  return (
    <Section title="Social Calendar" badge={`${totalPosts}+ posts`} icon={Share2} accent="blue">
      <div className="flex overflow-x-auto border-b border-slate-100 px-4 gap-1 pt-2 bg-slate-50">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all flex-shrink-0
              ${tab === t.key ? 'bg-white border border-b-white border-slate-200 text-slate-900 -mb-px shadow-sm' : 'text-slate-500 hover:text-slate-700'}
              ${t.proOnly && !isPro ? 'opacity-50' : ''}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
            {t.proOnly && !isPro && <Lock className="w-3 h-3" />}
          </button>
        ))}
      </div>

      {/* Facebook */}
      {tab === 'facebook' && <div className="divide-y divide-slate-100">
        {fbPosts.map((post, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><WeekPill week={post.week} /><span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">{post.theme}</span></div>
              <CopyButton text={post.copy} />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.copy}</p>
            {post.hashtags && post.hashtags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{post.hashtags.map((tag, j) => <span key={j} className="text-xs text-blue-600">#{tag.replace('#','')}</span>)}</div>}
          </div>
        ))}
        <div className="p-4 bg-slate-50"><CopyButton text={fbPosts.map(p => `Week ${p.week} — ${p.theme}\n\n${p.copy}`).join('\n\n---\n\n')} label="Copy All 6 Posts" /></div>
      </div>}

      {/* Instagram */}
      {tab === 'instagram' && <div className="divide-y divide-slate-100">
        {igPosts.map((post, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center justify-between mb-3"><WeekPill week={post.week} /><CopyButton text={`${post.caption}\n\n${post.hashtags.join(' ')}`} /></div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.caption}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">{post.hashtags.map((tag, j) => <span key={j} className="text-xs text-blue-600">{tag.startsWith('#') ? tag : `#${tag}`}</span>)}</div>
          </div>
        ))}
        <div className="p-4 bg-slate-50"><CopyButton text={igPosts.map(p => `${p.caption}\n\n${p.hashtags.join(' ')}`).join('\n\n---\n\n')} label="Copy All 6 Captions" /></div>
      </div>}

      {/* TikTok */}
      {tab === 'tiktok' && isPro && <div className="divide-y divide-slate-100">
        {tiktokPosts.map((post, i) => (
          <div key={i} className="p-5 space-y-3">
            <div className="flex items-center justify-between"><WeekPill week={post.week} /><CopyButton text={`HOOK: ${post.hook}\n\nSCRIPT:\n${post.script}\n\nTRENDING AUDIO: ${post.trendingAudio}`} /></div>
            <div className="bg-black rounded-xl p-4 text-white"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">🎬 Hook</p><p className="text-sm font-semibold">&ldquo;{post.hook}&rdquo;</p></div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">{post.script}</p>
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 border border-slate-100"><Music className="w-3.5 h-3.5 text-pink-500" /><span className="font-semibold text-slate-700">Audio:</span> {post.trendingAudio}</div>
            {post.onScreenText?.length > 0 && <div className="flex flex-wrap gap-2">{post.onScreenText.map((t, j) => <span key={j} className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded border border-pink-100">{t}</span>)}</div>}
          </div>
        ))}
      </div>}

      {/* LinkedIn */}
      {tab === 'linkedin' && isPro && <div className="divide-y divide-slate-100">
        {liPosts.map((post, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center justify-between mb-3"><WeekPill week={post.week} /><CopyButton text={`${post.post}\n\n${post.hashtags.map(h=>`#${h}`).join(' ')}`} /></div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.post}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">{post.hashtags.map((tag, j) => <span key={j} className="text-xs text-blue-700">#{tag}</span>)}</div>
          </div>
        ))}
      </div>}

      {/* X */}
      {tab === 'x' && isPro && <div className="divide-y divide-slate-100">
        {xPosts.map((thread, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center justify-between mb-3"><WeekPill week={thread.week} /><CopyButton text={thread.tweets.map((t,j)=>`${j+1}/${thread.tweets.length} ${t}`).join('\n\n')} label="Copy Thread" /></div>
            <div className="space-y-2">
              {thread.tweets.map((tweet, j) => (
                <div key={j} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="text-xs text-slate-400 font-bold flex-shrink-0 mt-0.5">{j+1}/{thread.tweets.length}</span>
                  <p className="text-sm text-slate-700 flex-1">{tweet}</p>
                  <CopyButton text={tweet} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>}

      {/* Stories */}
      {tab === 'stories' && isPro && <div className="divide-y divide-slate-100">
        {storiesPosts.map((story, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center gap-2 mb-3"><WeekPill week={story.week} /><span className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-2 py-0.5 rounded font-medium">{story.platform}</span></div>
            <div className="grid grid-cols-5 gap-2">
              {story.slides.map((slide, j) => (
                <div key={j} className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-2 text-center flex flex-col items-center justify-between" style={{aspectRatio:'9/16'}}>
                  <span className="text-xs text-slate-400">{slide.slideNumber}/5</span>
                  <p className="text-xs text-white font-semibold leading-snug text-center">{slide.text}</p>
                  {slide.cta && <span className="text-xs bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-full font-bold text-center">{slide.cta}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>}

      {/* Hashtags */}
      {tab === 'hashtags' && hashtagPacks && <div className="p-5 space-y-5">
        {([['justListed','Just Listed Pack','text-blue-600 bg-blue-50 border-blue-100'],['luxury','Luxury Pack','text-amber-700 bg-amber-50 border-amber-100'],['openHouse','Open House Pack','text-green-700 bg-green-50 border-green-100']] as [string,string,string][]).map(([key,label,cls]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span><CopyButton text={(hashtagPacks as any)[key].map((h:string)=>`#${h}`).join(' ')} /></div>
            <div className={`flex flex-wrap gap-1.5 p-3 rounded-xl border ${cls}`}>{(hashtagPacks as any)[key].map((tag:string,j:number)=><span key={j} className="text-xs font-medium">#{tag}</span>)}</div>
          </div>
        ))}
        {hashtagPacks.postingSchedule && (
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">6-Week Posting Schedule</span>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700">
              {hashtagPacks.postingSchedule.split('|').map((item,i) => <div key={i} className="flex items-start gap-2 py-1 border-b border-slate-100 last:border-0"><span className="text-amber-500 flex-shrink-0">→</span><span>{item.trim()}</span></div>)}
            </div>
          </div>
        )}
      </div>}

      {/* Pro lock for pro-only tabs */}
      {(['tiktok','linkedin','x','stories'] as SocialTab[]).includes(tab) && !isPro && (
        <div className="p-8 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center"><Lock className="w-5 h-5 text-purple-400" /></div>
          <div><p className="font-semibold text-slate-800 mb-1">Pro Feature</p><p className="text-sm text-slate-500 max-w-sm">Unlock TikTok, LinkedIn, X threads, and Stories content on the Pro plan.</p></div>
          <Link href="/dashboard/billing" className="inline-flex items-center gap-2 bg-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-purple-700 transition-colors"><Zap className="w-4 h-4" />Upgrade to Pro</Link>
        </div>
      )}
    </Section>
  )
}

// ── Section 3: Email Campaigns ─────────────────────────────────

function EmailCampaignsSection({ emailJustListed, emailStillAvailable, drip }: {
  emailJustListed?: string; emailStillAvailable?: string; drip?: Campaign['emailDrip']
}) {
  const emails = [
    ...(emailJustListed ? [{ key: 'jl', label: 'Just Listed', badge: 'Core', content: emailJustListed }] : []),
    ...(emailStillAvailable ? [{ key: 'sa', label: 'Still Available', badge: 'Core', content: emailStillAvailable }] : []),
    ...(drip ? [
      { key: 'su', label: 'Seller Update', content: drip.sellerUpdate },
      { key: 'ohi', label: 'Open House Invite', content: drip.openHouseInvite },
      { key: 'bd1', label: 'Buyer Day 1', content: drip.buyerDripDay1 },
      { key: 'bd7', label: 'Buyer Day 7', content: drip.buyerDripDay7 },
      { key: 'bd14', label: 'Buyer Day 14', content: drip.buyerDripDay14 },
      { key: 'bd30', label: 'Buyer Day 30', content: drip.buyerDripDay30 },
      { key: 'ps', label: 'Post-Showing', content: drip.postShowingFeedback },
      { key: 'mr', label: 'Market Report', content: drip.marketReport },
    ] : []),
  ]
  const [active, setActive] = useState(emails[0]?.key ?? null)
  const activeEmail = emails.find(e => e.key === active)

  return (
    <Section title="Email Campaigns" badge={`${emails.length} templates`} icon={Mail} accent="green">
      <div className="flex overflow-x-auto gap-1 p-3 border-b border-slate-100 bg-slate-50">
        {emails.map(e => (
          <button key={e.key} onClick={() => setActive(e.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${active === e.key ? 'bg-white text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white'}`}>
            {e.label}
            {'badge' in e && e.badge && <span className="ml-1.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{e.badge}</span>}
          </button>
        ))}
      </div>
      {activeEmail && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-slate-900">{activeEmail.label}</span>
            <div className="flex gap-2">
              <CopyButton text={activeEmail.content} />
              <button className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all">
                <Send className="w-3.5 h-3.5" /> Schedule
              </button>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif border border-slate-100">{activeEmail.content}</div>
        </div>
      )}
    </Section>
  )
}

// ── Section 4: Print & Offline ─────────────────────────────────

function PrintOfflineSection({ print, campaignId }: { print: NonNullable<Campaign['printMaterials']>; campaignId: string }) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const handlePdf = async () => {
    setDownloadingPdf(true)
    try { const res = await fetch(`/api/campaigns/${campaignId}/pdf`,{method:'POST'}); const d = await res.json(); if(d.url) window.open(d.url,'_blank') }
    catch { alert('PDF failed.') } finally { setDownloadingPdf(false) }
  }
  const items = [
    { label: 'Yard Sign Rider', icon: '🪧', note: 'Standard 6" rider', content: print.yardSignRider },
    { label: 'Postcard Headline', icon: '📮', content: print.postcardHeadline },
    { label: 'Postcard Body', icon: '📮', note: 'Door-knocker back copy', content: print.postcardBody },
    { label: 'Open House Info Packet', icon: '🏡', note: 'Welcome paragraph', content: print.openHouseSignIn },
    { label: 'Brochure Copy', icon: '📄', content: print.brochureCopy },
    { label: 'Magazine Ad', icon: '📰', note: 'Premium format', content: print.magazineAd },
  ]
  return (
    <Section title="Print & Offline" badge="6 formats" icon={Printer} accent="amber">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap bg-amber-50">
        <div><p className="text-sm font-semibold text-slate-900">Print-Ready Listing Flyer</p><p className="text-xs text-slate-500 mt-0.5">Fully branded with your colors and agent info</p></div>
        <div className="flex gap-2">
          <a href={`/flyer/${campaignId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"><ExternalLink className="w-4 h-4" />View Flyer</a>
          <button onClick={handlePdf} disabled={downloadingPdf} className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60">
            {downloadingPdf ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</> : <><Download className="w-4 h-4" />Download PDF</>}
          </button>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><span className="text-base">{item.icon}</span><span className="text-sm font-semibold text-slate-900">{item.label}</span></div>
              <CopyButton text={item.content} />
            </div>
            {item.note && <p className="text-xs text-slate-400 mb-2">{item.note}</p>}
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-100">{item.content}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Section 5: Video + Virtual Tour ───────────────────────────

function VideoSection({ reelScripts, virtualTourScripts }: { reelScripts: ReelScript[]; virtualTourScripts: VirtualTourScript[] }) {
  const [tab, setTab] = useState<'reels'|'virtual'>('reels')
  return (
    <Section title="Video & Reel Scripts" badge={`${reelScripts.length + virtualTourScripts.length} scripts`} icon={Video} accent="purple">
      <div className="flex gap-2 p-4 border-b border-slate-100">
        {[{k:'reels',l:'Social Reels',icon:Play,count:reelScripts.length},{k:'virtual',l:'Virtual Tour & Drone',icon:Mic,count:virtualTourScripts.length}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${tab === t.k ? 'bg-purple-100 text-purple-800' : 'text-slate-500 hover:bg-slate-100'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.l} ({t.count})
          </button>
        ))}
      </div>
      {tab === 'reels' && <div className="divide-y divide-slate-100">
        {reelScripts.map((reel, i) => (
          <div key={i} className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap"><WeekPill week={reel.week} /><span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">{reel.title}</span><span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{reel.duration}</span></div>
              <CopyButton text={`HOOK:\n${reel.hook}\n\nSCRIPT:\n${reel.script}\n\nON-SCREEN:\n${reel.captions?.join('\n')}\n\nMUSIC: ${reel.music}`} />
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4"><p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1.5">🎬 Opening Hook</p><p className="text-sm text-slate-800 font-semibold">&ldquo;{reel.hook}&rdquo;</p></div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100 leading-relaxed">{reel.script}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {reel.captions?.length > 0 && <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">On-Screen Text</p><div className="space-y-1">{reel.captions.map((cap,j) => <div key={j} className="flex items-center gap-2"><span className="w-4 h-4 bg-slate-200 rounded text-xs flex items-center justify-center text-slate-600 flex-shrink-0">{j+1}</span><span className="text-xs text-slate-700">{cap}</span></div>)}</div></div>}
              {reel.music && <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Music className="w-3 h-3" />Music Vibe</p><p className="text-sm text-slate-700">{reel.music}</p></div>}
            </div>
          </div>
        ))}
        <div className="p-4 bg-slate-50 border-t border-slate-100"><CopyButton text={reelScripts.map(r=>`WEEK ${r.week} — ${r.title}\nHOOK: "${r.hook}"\n\nSCRIPT:\n${r.script}\n\nMUSIC: ${r.music}`).join('\n\n'+'─'.repeat(30)+'\n\n')} label="Copy All Reel Scripts" /></div>
      </div>}
      {tab === 'virtual' && <div className="divide-y divide-slate-100">
        {virtualTourScripts.map((script, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-medium">{script.type}</span><span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{script.duration}</span></div>
              <CopyButton text={script.script} />
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-indigo-100">{script.script}</div>
          </div>
        ))}
      </div>}
    </Section>
  )
}

// ── Section 6: Microsite Copy Editor ──────────────────────────

function MicrositeCopySection({ micrositeCopy, micrositeSlug, micrositePublished, campaignId, onToggle, publishing }: {
  micrositeCopy: NonNullable<Campaign['micrositeCopy']>; micrositeSlug?: string; micrositePublished?: boolean
  campaignId: string; onToggle: () => void; publishing: boolean
}) {
  const fields = [
    { label: 'Hero Headline', content: micrositeCopy.heroHeadline, big: true },
    { label: 'Hero Subheadline', content: micrositeCopy.heroSubheadline },
    { label: 'About Heading', content: micrositeCopy.aboutHeading },
    { label: 'About Body', content: micrositeCopy.aboutBody, multi: true },
    { label: 'Neighborhood Heading', content: micrositeCopy.neighborhoodHeading },
    { label: 'Neighborhood Body', content: micrositeCopy.neighborhoodBody, multi: true },
    { label: 'CTA Heading', content: micrositeCopy.ctaHeading },
    { label: 'CTA Subtext', content: micrositeCopy.ctaSubtext },
    { label: 'Photo Caption Template', content: micrositeCopy.photoCaptionTemplate },
  ]
  return (
    <Section title="Microsite Copy Editor" badge="Live Page" icon={Globe2} accent="blue">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-blue-50 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${micrositePublished ? 'bg-green-500' : 'bg-slate-400'}`} />
          <span className="text-sm font-semibold text-slate-900">{micrositePublished ? 'Microsite is live' : 'Microsite is unpublished'}</span>
          {micrositePublished && micrositeSlug && <a href={`/l/${micrositeSlug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Eye className="w-3 h-3" />View live</a>}
        </div>
        <button onClick={onToggle} disabled={publishing}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${micrositePublished ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-green-600 text-white hover:bg-green-700'}`}>
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : micrositePublished ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
          {publishing ? 'Updating...' : micrositePublished ? 'Unpublish' : 'Publish Microsite'}
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {fields.map((field, i) => (
          <div key={i} className="p-5">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{field.label}</span><CopyButton text={field.content} /></div>
            {field.big ? <p className="text-lg font-display font-semibold text-slate-900">{field.content}</p>
              : field.multi ? <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100">{field.content}</div>
              : <p className="text-sm text-slate-700">{field.content}</p>}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Section 7: Photo Captions ──────────────────────────────────

function PhotoCaptionsSection({ captions, photos }: { captions: PhotoCaption[]; photos: string[] }) {
  return (
    <Section title="Photo Captions" badge={`${captions.length} photos`} icon={Camera} accent="rose">
      <p className="text-xs text-slate-400 italic px-5 py-3 border-b border-slate-100">Alt text, Instagram captions, story overlay text, and staging tips for each photo.</p>
      <div className="divide-y divide-slate-100">
        {captions.map((cap, i) => (
          <div key={i} className="p-5">
            <div className="flex gap-4">
              {photos[i]
                ? <a href={photos[i]} target="_blank" rel="noopener noreferrer" className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 hover:opacity-80 transition-opacity"><img src={photos[i]} alt={cap.altText} className="w-full h-full object-cover" /></a>
                : <div className="w-20 h-20 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center"><Camera className="w-6 h-6 text-slate-300" /></div>
              }
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">{cap.room}</span><CopyButton text={`ALT: ${cap.altText}\n\nIG: ${cap.instagramCaption}\n\nOverlay: ${cap.overlayText}\n\nTip: ${cap.stagingNote}`} label="Copy All" /></div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"><p className="text-xs text-slate-400 mb-1">Alt Text</p><p className="text-xs text-slate-700">{cap.altText}</p></div>
                  <div className="bg-pink-50 rounded-lg p-2.5 border border-pink-100"><p className="text-xs text-pink-500 mb-1">Instagram Caption</p><p className="text-xs text-slate-700">{cap.instagramCaption}</p></div>
                  <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-100"><p className="text-xs text-purple-500 mb-1">Story Overlay</p><p className="text-xs text-slate-700 font-semibold">{cap.overlayText}</p></div>
                  <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100"><p className="text-xs text-amber-600 mb-1">Staging Tip</p><p className="text-xs text-slate-700">{cap.stagingNote}</p></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Main Page ──────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [planTier, setPlanTier] = useState<string>('free')

  useEffect(() => {
    fetchCampaign()
    fetch('/api/billing/info').then(r => r.ok ? r.json() : null).then(d => { if (d?.planTier) setPlanTier(d.planTier) }).catch(() => {})
  }, [id])

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`)
      if (!res.ok) { if (res.status === 404) router.push('/dashboard/campaigns'); throw new Error('Not found') }
      const data = await res.json()
      setCampaign(data.campaign)
    } catch { toast.error('Could not load campaign') }
    finally { setLoading(false) }
  }

  const toggleMicrosite = async () => {
    if (!campaign) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/microsite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish: !campaign.micrositePublished }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setCampaign(prev => prev ? { ...prev, micrositePublished: data.published } : prev)
      toast.success(data.published ? 'Microsite published!' : 'Microsite unpublished')
    } catch (err: any) { toast.error(err.message || 'Failed') }
    finally { setPublishing(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
  if (!campaign) return null

  const address = [campaign.listing?.address, campaign.listing?.city, campaign.listing?.state].filter(Boolean).join(', ')
  const photos = (campaign.listing?.photos ?? []) as string[]
  const isPro = ['pro', 'brokerage', 'enterprise'].includes(planTier)
  const isStarter = ['starter', 'pro', 'brokerage', 'enterprise'].includes(planTier)

  let reelScripts: ReelScript[] = []
  let virtualTourScripts: VirtualTourScript[] = []
  if (campaign.videoScript) {
    try {
      const parsed = JSON.parse(campaign.videoScript)
      reelScripts = parsed.reelScripts ?? []
      virtualTourScripts = parsed.virtualTourScripts ?? []
    } catch {}
  }
  if (!reelScripts.length && (campaign as any).reelScripts) reelScripts = (campaign as any).reelScripts ?? []
  if (!virtualTourScripts.length && (campaign as any).virtualTourScripts) virtualTourScripts = (campaign as any).virtualTourScripts ?? []

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to Campaigns
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {(campaign.brandKit?.logoUrl || campaign.brandKit?.brokerageLogo) && (
              <div className="flex items-center gap-3 mb-3">
                {campaign.brandKit?.logoUrl && <img src={campaign.brandKit.logoUrl} alt="Agent Logo" className="h-8 max-w-[100px] object-contain" />}
                {campaign.brandKit?.brokerageLogo && <img src={campaign.brandKit.brokerageLogo} alt="Brokerage Logo" className="h-7 max-w-[90px] object-contain opacity-80" />}
              </div>
            )}
            <h1 className="font-display text-2xl font-semibold text-slate-900">{address || 'Campaign'}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              {campaign.listing?.price && <span>${Number(campaign.listing.price).toLocaleString()}</span>}
              {campaign.listing?.bedrooms && <span>{campaign.listing.bedrooms} bd</span>}
              {campaign.listing?.bathrooms && <span>{campaign.listing.bathrooms} ba</span>}
              {campaign.listing?.sqft && <span>{campaign.listing.sqft?.toLocaleString()} sqft</span>}
              <span className={`px-2 py-0.5 rounded-full capitalize font-medium ${campaign.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{campaign.status}</span>
              {campaign.generationMs && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Generated in {(campaign.generationMs/1000).toFixed(1)}s</span>}
            </div>
          </div>
          {campaign.micrositeSlug && campaign.micrositePublished && (
            <a href={`/l/${campaign.micrositeSlug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              <Eye className="w-3.5 h-3.5" />View Microsite ({campaign.micrositeViews ?? 0} views)
            </a>
          )}
        </div>
      </div>

      {/* Property Photos */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-display font-semibold text-slate-900">Property Photos</span>
          {photos.length > 0 && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{photos.length} photos</span>}
        </div>
        {photos.length > 0
          ? <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">{photos.slice(0,6).map((photo,i) => <a key={i} href={photo} target="_blank" rel="noopener noreferrer" className="aspect-video rounded-xl overflow-hidden bg-slate-100 block hover:opacity-90 transition-opacity"><img src={photo} alt={`Photo ${i+1}`} className="w-full h-full object-cover" /></a>)}</div>
          : <div className="p-8 text-center"><div className="text-4xl mb-3">🏡</div><p className="text-sm font-semibold text-slate-500 mb-1">No photos available</p><p className="text-xs text-slate-400">MLS photos will appear here for real listings.</p></div>
        }
      </div>

      {/* 1. Listing Copy */}
      {campaign.listingCopy
        ? <ListingCopySection data={campaign.listingCopy} />
        : null}

      {/* 2. Social Calendar */}
      <SocialCalendarSection campaign={campaign} isPro={isPro} />

      {/* 3. Email Campaigns */}
      <EmailCampaignsSection emailJustListed={campaign.emailJustListed} emailStillAvailable={campaign.emailStillAvailable} drip={isStarter ? campaign.emailDrip : undefined} />
      {!isStarter && campaign.emailJustListed && (
        <LockedSection title="Email Drip Sequences" icon={Mail} plan="Starter"
          description="Buyer Day 1–30 drip, seller updates, open house invites, post-showing feedback, and market report newsletters." />
      )}

      {/* 4. Print & Offline */}
      {campaign.printMaterials
        ? <PrintOfflineSection print={campaign.printMaterials} campaignId={campaign.id} />
        : null}

      {/* 5. Video & Virtual Tour */}
      {isPro && (reelScripts.length > 0 || virtualTourScripts.length > 0)
        ? <VideoSection reelScripts={reelScripts} virtualTourScripts={virtualTourScripts} />
        : <LockedSection title="Video & Reel Scripts + Virtual Tour" icon={Video} plan="Pro"
            description="6 weeks of social reel scripts plus Matterport walkthrough narration, 30-sec highlight reel, drone voice-over, and timed walkthrough scripts." />
      }

      {/* 6. Microsite Copy Editor */}
      {isStarter && campaign.micrositeCopy
        ? <MicrositeCopySection micrositeCopy={campaign.micrositeCopy} micrositeSlug={campaign.micrositeSlug} micrositePublished={campaign.micrositePublished} campaignId={campaign.id} onToggle={toggleMicrosite} publishing={publishing} />
        : !isStarter
          ? <LockedSection title="Microsite Copy Editor" icon={Globe2} plan="Starter"
              description="Hero headline, about section, neighborhood story, and CTA copy for your listing microsite — edit and publish in one click." />
          : null
      }

      {/* 7. Photo Captions */}
      {campaign.photoCaptions && campaign.photoCaptions.length > 0
        ? <PhotoCaptionsSection captions={campaign.photoCaptions} photos={photos} />
        : null}
    </div>
  )
}
