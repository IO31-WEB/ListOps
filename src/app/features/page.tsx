import Link from 'next/link'
import { LogoMark } from '@/components/ui/logo'
import { JsonLd } from '@/components/seo/json-ld'
import { pageMetadata, breadcrumbLd, faqLd, LIMITS, PRODUCT_SUMMARY } from '@/lib/seo'
import { PLANS } from '@/lib/plans'

export const metadata = pageMetadata({
  title: 'Features: 6-Week Listing Campaigns, Microsites and Commercial Tools',
  description: 'What ListOps generates for each plan: social calendars, email, MLS descriptions, flyers, microsites, seller reports, and commercial offering memorandum tools. Includes what it does not do.',
  path: '/features',
})

const GROUPS = [
  { h: 'Every plan', items: ['10 headline variations, MLS-ready description and bullet points', 'Neighborhood story and SEO meta description', 'Tone variants and a Spanish description', '6-week Facebook and Instagram calendars', 'Just Listed and Still Available emails', 'Print-ready flyer, yard sign, postcard, brochure and magazine ad copy', 'Fair Housing language check with one-click rewrites'] },
  { h: 'Starter and above', items: ['Brand kit, writing persona and agent tagline', 'AI photo captions from your uploaded photos', 'Eight email templates', 'Auto-generated listing microsite with lead forms and view analytics', 'Trackable QR codes with scan counts'] },
  { h: 'Pro and above', items: ['Unlimited campaigns', 'Video, reel, TikTok, LinkedIn, X and Stories scripts for six weeks', 'Virtual tour narration and hashtag packs', 'Shareable seller report and seller approval portal', 'Social post calendar with a daily due-email', 'Lead CSV export and webhook', '2 team seats (you plus one teammate)'] },
  { h: 'Commercial and above', items: ['Commercial campaigns with a Commercial/Residential switch', 'Offering memorandum sections, teaser and one-page brochure', 'Investment snapshot, financing scenario and Offering Readiness score, calculated from your own numbers', 'Investor and tenant outreach drafts with compliant sending', '2 team seats'] },
  { h: 'Brokerage', items: ['25 team seats, roles and a team activity log', 'Brokerage brand override and compliance profile', 'Agent performance dashboard and CSV export of team campaigns'] },
]

const FAQS = [
  { q: 'Which plan includes commercial real estate campaigns?', a: 'Commercial and Brokerage. Free, Starter and Pro do not include commercial campaigns, offering memorandum sections or outreach sending.' },
  { q: 'How many team seats does each plan include?', a: `Free and Starter ${PLANS.find(p => p.id === 'starter')?.maxAgents}, Pro and Commercial ${PLANS.find(p => p.id === 'pro')?.maxAgents}, Brokerage ${PLANS.find(p => p.id === 'brokerage')?.maxAgents}. Teammates join by email invite and share the plan only while the owner's subscription is active.` },
  { q: 'Does ListOps pull comps or MLS data?', a: LIMITS[1] },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <JsonLd data={[breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Features', path: '/features' }]), faqLd(FAQS)]} />
      <nav className="border-b border-amber-100/60">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5"><LogoMark className="w-8 h-8" /><span className="font-display font-semibold text-slate-900 text-lg">ListOps</span></Link>
          <Link href="/sign-up" className="bg-slate-900 text-amber-50 text-sm font-medium px-4 py-2 rounded-lg">Try Free</Link>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-14">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900 mb-4">What ListOps generates for every listing</h1>
        <p className="text-lg text-slate-600 mb-10 max-w-3xl">{PRODUCT_SUMMARY}</p>
        <div className="grid gap-6 md:grid-cols-2">
          {GROUPS.map(g => (
            <section key={g.h} className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="font-display text-xl font-semibold text-slate-900 mb-3">{g.h}</h2>
              <ul className="space-y-2 text-slate-700 text-sm list-disc pl-5">{g.items.map(i => <li key={i}>{i}</li>)}</ul>
            </section>
          ))}
        </div>
        <section className="mt-10 bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-3">What ListOps does not do</h2>
          <ul className="space-y-2 text-slate-700 text-sm list-disc pl-5">{LIMITS.map(l => <li key={l}>{l}</li>)}</ul>
        </section>
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold text-slate-900 mb-4">Questions</h2>
          {FAQS.map(f => (<div key={f.q} className="mb-4"><h3 className="font-semibold text-slate-900">{f.q}</h3><p className="text-slate-600 text-sm">{f.a}</p></div>))}
        </section>
        <p className="mt-10 text-sm text-slate-600">
          See <Link href="/pricing" className="underline">pricing</Link>, <Link href="/commercial" className="underline">commercial real estate tools</Link> or the <Link href="/blog" className="underline">blog</Link>.
        </p>
      </main>
    </div>
  )
}
