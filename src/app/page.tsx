import Link from 'next/link'
import { ArrowRight, CheckCircle, Zap, Star, Users, TrendingUp, Shield, Clock } from 'lucide-react'
import { PLANS } from '@/lib/stripe'
import { formatCurrency } from '@/lib/utils'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* ── Navigation ─────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-amber-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-display font-semibold text-slate-900 text-lg">CampaignAI</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">How It Works</Link>
              <Link href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Features</Link>
              <Link href="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Pricing</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/sign-in" className="hidden sm:block text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors px-4 py-2">
                Sign In
              </Link>
              <Link href="/sign-up" className="inline-flex items-center gap-2 bg-slate-900 text-amber-50 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                Try Free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            MLS-Connected • Claude AI • ~90s Generation
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900 leading-[1.05] mb-6 animate-fade-in animate-stagger-1">
            6-Week Campaign.
            <br />
            <em className="text-gold-shimmer not-italic">One Click.</em>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in animate-stagger-2">
            Enter your MLS listing ID and get a complete 6-week marketing campaign — Facebook posts, Instagram captions, a print-ready flyer, and email copy — all generated in about 90 seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animate-stagger-3">
            <Link href="/sign-up" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 text-amber-50 font-semibold px-8 py-4 rounded-xl hover:bg-slate-800 transition-all hover:shadow-lg hover:shadow-slate-900/20 text-base">
              Start Free — 3 Campaigns Included
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-medium px-8 py-4 rounded-xl hover:border-slate-300 transition-all text-base">
              See Pricing
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-slate-500 animate-fade-in animate-stagger-4">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-amber-500" /> No credit card needed</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-amber-500" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-amber-500" /> MLS-connected</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-4xl mx-auto mt-20 grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 rounded-2xl overflow-hidden shadow-sm animate-fade-in animate-stagger-5">
          {[
            { value: '~90s', label: 'Avg. Generation Time' },
            { value: '6', label: 'Content Types Generated' },
            { value: '6-Week', label: 'Campaign Per Listing' },
            { value: '100%', label: 'MLS Connected' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white px-6 py-6 text-center">
              <div className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-amber-600 font-medium text-sm uppercase tracking-widest mb-3">The Process</p>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900">
              From MLS to Market <em>in Three Steps</em>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: '01',
                title: 'Paste Your MLS ID',
                desc: 'We connect directly to your MLS board via SimplyRETS and pull your listing data, photos, specs, and agent details automatically. No manual entry required.',
                icon: '🔗',
              },
              {
                num: '02',
                title: 'Click Generate',
                desc: 'Claude AI reads your listing and produces a complete 6-week campaign — Facebook posts, Instagram captions, a printable flyer, and two email drafts. Every word tailored to your property.',
                icon: '⚡',
              },
              {
                num: '03',
                title: 'Copy and Publish',
                desc: 'Every piece of content is formatted and ready to use immediately. One click copies to clipboard. Or use Pro scheduling to publish directly to Facebook and Instagram.',
                icon: '🚀',
              },
            ].map((step) => (
              <div key={step.num} className="relative group">
                <div className="bg-slate-50 rounded-2xl p-8 h-full card-hover border border-slate-100">
                  <div className="flex items-center gap-4 mb-5">
                    <span className="font-display text-4xl font-bold text-amber-200">{step.num}</span>
                    <span className="text-3xl">{step.icon}</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-[var(--cream)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-amber-600 font-medium text-sm uppercase tracking-widest mb-3">What You Get</p>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900">
              Everything an Agent <em>Actually Needs</em>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📱', tag: 'FB', title: '6-Week Facebook Calendar', desc: 'Themed posts for launch, features, neighborhood, open house, lifestyle, and final call.', plan: 'All plans' },
              { icon: '📸', tag: 'IG', title: '6-Week Instagram Calendar', desc: 'Platform-optimized captions with curated hashtag sets. Your listing URL in every post.', plan: 'All plans' },
              { icon: '🖨️', tag: 'FL', title: 'Print-Ready Flyer', desc: 'Professional listing flyer with photos, specs, and your agent branding. Export as PDF instantly.', plan: 'All plans' },
              { icon: '📧', tag: 'EM', title: 'Email Newsletter Copy', desc: 'Just Listed and Still Available emails ready to paste into any email platform.', plan: 'All plans' },
              { icon: '🎯', tag: 'BK', title: 'Brand Kit', desc: 'Upload your logo, headshot, colors, and contact info once. Applied to every campaign automatically.', plan: 'Starter+' },
              { icon: '🌐', tag: 'MS', title: 'Listing Microsite', desc: 'Auto-generated beautiful property page hosted at campaignai.io/l/[slug] — shareable instantly.', plan: 'Pro+' },
              { icon: '⏰', tag: 'SC', title: 'Social Scheduling', desc: 'Publish directly to Facebook and Instagram — no copy-pasting. Schedule weeks in advance.', plan: 'Pro+' },
              { icon: '🎬', tag: 'VS', title: 'Video & Reel Scripts', desc: 'AI-written scripts optimized for short-form video. Perfect for Reels and TikTok.', plan: 'Pro+' },
              { icon: '🏢', tag: 'WL', title: 'White-Label', desc: 'Your brokerage brand on all outputs. Remove all CampaignAI branding from flyers and emails.', plan: 'Brokerage+' },
            ].map((feature) => (
              <div key={feature.title} className="bg-white rounded-2xl p-6 border border-slate-100 card-hover">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-2xl">{feature.icon}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{feature.tag}</span>
                    <span className="text-xs text-slate-400">{feature.plan}</span>
                  </div>
                </div>
                <h3 className="font-display font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Preview ────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 grain">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-amber-400 font-medium text-sm uppercase tracking-widest mb-3">Simple Pricing</p>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold text-white">
              Plans That Grow <em className="text-amber-400">With You</em>
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">Start free. Upgrade when you need more. No contracts, cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`rounded-2xl p-6 flex flex-col ${plan.highlighted ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-white border border-slate-700'}`}>
                {plan.badge && (
                  <span className="inline-block text-xs font-semibold bg-slate-900 text-amber-400 px-2.5 py-1 rounded-full mb-4 w-fit">
                    {plan.badge}
                  </span>
                )}
                <div className="font-display text-xl font-semibold mb-1">{plan.name}</div>
                <div className={`text-sm mb-4 ${plan.highlighted ? 'text-slate-700' : 'text-slate-400'}`}>{plan.tagline}</div>
                <div className="mb-6">
                  {plan.monthlyPrice === 0 ? (
                    <span className="font-display text-3xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="font-display text-3xl font-bold">{formatCurrency(plan.monthlyPrice)}</span>
                      <span className={`text-sm ${plan.highlighted ? 'text-slate-700' : 'text-slate-400'}`}>/mo</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.filter(f => f.included).slice(0, 5).map((f) => (
                    <li key={f.text} className={`flex items-start gap-2 text-xs ${plan.highlighted ? 'text-slate-800' : 'text-slate-300'}`}>
                      <CheckCircle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-slate-900' : 'text-amber-500'}`} />
                      {f.text}
                    </li>
                  ))}
                </ul>
                <Link href={plan.id === 'free' ? '/sign-up' : `/sign-up?plan=${plan.id}`}
                  className={`w-full text-center text-sm font-semibold py-3 rounded-xl transition-all ${plan.highlighted ? 'bg-slate-900 text-amber-50 hover:bg-slate-800' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/pricing" className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors">
              Compare all features in detail →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social Proof ───────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-semibold text-slate-900">Loved by Real Estate Agents</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I used to spend 3 hours creating marketing content for each listing. Now it takes me 60 seconds. CampaignAI paid for itself on the first listing.",
                author: "Sarah M.",
                role: "REALTOR® • Austin, TX",
                rating: 5,
              },
              {
                quote: "The flyers are genuinely better than what my brokerage produces. Every client asks who does our marketing. I tell them it's AI and they're shocked.",
                author: "Marcus J.",
                role: "Broker • Miami, FL",
                rating: 5,
              },
              {
                quote: "Upgraded to Brokerage plan and my whole team uses it. We've cut our marketing spend by $2,400/month and our listings look more professional than ever.",
                author: "Jennifer R.",
                role: "Team Lead • Denver, CO",
                rating: 5,
              },
            ].map((review) => (
              <div key={review.author} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-5 italic">"{review.quote}"</p>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{review.author}</div>
                  <div className="text-xs text-slate-500">{review.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[var(--cream)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900 mb-4">
            Your Listings Deserve <em>Better Marketing.</em>
          </h2>
          <p className="text-slate-600 mb-8 text-lg">Generate a complete 6-week marketing campaign for any listing in about 90 seconds — fully branded, ready to publish.</p>
          <Link href="/sign-up" className="inline-flex items-center gap-2 bg-slate-900 text-amber-50 font-semibold px-10 py-4 rounded-xl hover:bg-slate-800 transition-all hover:shadow-xl hover:shadow-slate-900/20 text-base">
            Start Free — 3 Campaigns Included
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-slate-400 mt-4">No credit card required • Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-slate-900" />
                </div>
                <span className="font-display font-semibold text-white">CampaignAI</span>
              </div>
              <p className="text-sm leading-relaxed">AI-powered marketing campaigns for real estate agents. MLS-connected, Claude AI-powered.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                <li><Link href="/sign-up" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/affiliates" className="hover:text-white transition-colors">Affiliate Program</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/gdpr" className="hover:text-white transition-colors">GDPR</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>© {new Date().getFullYear()} CampaignAI. All rights reserved.</p>
            <p>Powered by Claude AI + SimplyRETS MLS</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
