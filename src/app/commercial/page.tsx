import Link from 'next/link'
import { LogoMark } from '@/components/ui/logo'
import { JsonLd } from '@/components/seo/json-ld'
import { pageMetadata, breadcrumbLd, faqLd, LIMITS } from '@/lib/seo'
import { PLANS } from '@/lib/plans'
import { BLOG_POSTS } from '@/lib/blog-posts'

export const metadata = pageMetadata({
  title: 'Commercial Real Estate Marketing: Offering Memorandums, Teasers and Outreach',
  description: 'ListOps Commercial gives brokers offering memorandum sections, teasers, one-pagers, investor outreach drafts and an investment snapshot, built from the numbers you enter. No data feeds, no scraping.',
  path: '/commercial',
})

const price = PLANS.find(p => p.id === 'commercial')?.monthlyPrice

const FAQS = [
  { q: 'What does the ListOps Commercial plan include?', a: `Commercial campaigns for sale and lease listings: offering memorandum sections, a teaser, a one-pager and brochure, investor and tenant outreach drafts, an investment snapshot, a financing scenario and an Offering Readiness score. It costs $${price}/month and includes 2 team seats.` },
  { q: 'Where do the investment numbers come from?', a: 'Only from figures you enter (price, NOI, cap rate, square footage, units, loan terms). ListOps calculates price per square foot and per unit, implied cap rate, and a financing scenario with debt service and DSCR. It does not fetch comps or market data.' },
  { q: 'Can Free, Starter or Pro users see commercial features?', a: 'No. Commercial campaigns are available on Commercial, Brokerage and Enterprise only.' },
]

export default function CommercialPage() {
  const posts = BLOG_POSTS.filter(p => p.category.toLowerCase().includes('commercial')).slice(0, 4)
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <JsonLd data={[breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Commercial', path: '/commercial' }]), faqLd(FAQS)]} />
      <nav className="border-b border-amber-100/60">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5"><LogoMark className="w-8 h-8" /><span className="font-display font-semibold text-slate-900 text-lg">ListOps</span></Link>
          <Link href="/pricing" className="bg-slate-900 text-amber-50 text-sm font-medium px-4 py-2 rounded-lg">See pricing</Link>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-14">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900 mb-4">Marketing for commercial listings, from the numbers you already have</h1>
        <p className="text-lg text-slate-600 mb-10 max-w-3xl">Turn a sale or lease listing into an offering memorandum outline, teaser, one-pager and investor outreach. Every figure comes from what you enter; nothing is invented.</p>
        <div className="grid gap-6 md:grid-cols-3 mb-10">
          {[['Offering materials', 'Offering memorandum sections, teaser and a one-page brochure written for investors and tenants.'], ['Investment snapshot', 'Price per SF and per unit, implied cap rate, financing scenario with DSCR and an Offering Readiness score.'], ['Outreach', 'Investor and tenant email drafts with sender identity, postal address and one-click unsubscribe built in.']].map(([h, t]) => (
            <section key={h} className="bg-white border border-slate-200 rounded-2xl p-6"><h2 className="font-display text-lg font-semibold text-slate-900 mb-2">{h}</h2><p className="text-sm text-slate-600">{t}</p></section>
          ))}
        </div>
        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-10">
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-3">Boundaries</h2>
          <ul className="space-y-2 text-slate-700 text-sm list-disc pl-5">{LIMITS.map(l => <li key={l}>{l}</li>)}</ul>
        </section>
        <section className="mb-10">
          <h2 className="font-display text-2xl font-semibold text-slate-900 mb-4">Questions</h2>
          {FAQS.map(f => (<div key={f.q} className="mb-4"><h3 className="font-semibold text-slate-900">{f.q}</h3><p className="text-slate-600 text-sm">{f.a}</p></div>))}
        </section>
        {posts.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-semibold text-slate-900 mb-4">Guides for commercial brokers</h2>
            <ul className="space-y-2 text-sm">{posts.map(p => <li key={p.slug}><Link className="underline text-slate-800" href={`/blog/${p.slug}`}>{p.title}</Link></li>)}</ul>
          </section>
        )}
        <p className="mt-10 text-sm text-slate-600">Also see <Link href="/features" className="underline">all features</Link> and <Link href="/pricing" className="underline">pricing</Link>.</p>
      </main>
    </div>
  )
}
