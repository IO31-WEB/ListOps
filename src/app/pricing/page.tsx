'use client'

import { useState } from 'react'
import Link from 'next/link'
import { House, ArrowRight, Check, X, HelpCircle } from 'lucide-react'
import { PLANS, ENTERPRISE_PLAN } from '@/lib/plans'
import { formatCurrency } from '@/lib/utils'

const FEATURE_CATEGORIES = [
  {
    name: 'Content Generation',
    features: [
      { name: 'Campaigns per month',                          free: '3',     starter: '5',     pro: 'Unlimited', brokerage: 'Unlimited' },
      { name: 'MLS listing data auto-pull (500+ boards)',     free: true,    starter: true,    pro: true,        brokerage: true },
      { name: '10 headline variations',                       free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Full MLS description + bullet points',         free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Neighborhood story + SEO meta',                free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Tone variants (luxury / investor / FTB)',      free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Spanish listing description',                  free: true,    starter: true,    pro: true,        brokerage: true },
      { name: '6-week Facebook calendar',                     free: true,    starter: true,    pro: true,        brokerage: true },
      { name: '6-week Instagram calendar',                    free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Just Listed + Still Available emails',         free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Print materials (yard sign, postcard, brochure, magazine ad)', free: true, starter: true, pro: true, brokerage: true },
      { name: 'Print-ready listing flyer (PDF)',              free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Email drip (8 templates: buyer + seller)',     free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'AI photo captions (per MLS photo)',            free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'Microsite copy editor',                        free: false,   starter: true,    pro: true,        brokerage: true },
      { name: '6-week video & reel scripts',                  free: false,   starter: false,   pro: true,        brokerage: true },
      { name: 'Virtual tour narration (4 script types)',      free: false,   starter: false,   pro: true,        brokerage: true },
      { name: '6-week TikTok scripts',                        free: false,   starter: false,   pro: true,        brokerage: true },
      { name: '6-week LinkedIn posts',                        free: false,   starter: false,   pro: true,        brokerage: true },
      { name: '6-week X (Twitter) threads',                   free: false,   starter: false,   pro: true,        brokerage: true },
      { name: '6-week Stories (IG + FB)',                     free: false,   starter: false,   pro: true,        brokerage: true },
      { name: 'Hashtag strategy packs (3 packs)',             free: false,   starter: false,   pro: true,        brokerage: true },
    ],
  },
  {
    name: 'Brand & Customization',
    features: [
      { name: 'Brand kit (logo, colors, headshot)',           free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'AI writing persona (tone selector)',           free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'Custom agent tagline',                         free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'Remove ListOps branding',                      free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'Flyer templates',                              free: '1',     starter: '3',     pro: '15+',       brokerage: '15+ Custom' },
      { name: 'White-label all outputs',                      free: false,   starter: false,   pro: false,       brokerage: true },
      { name: 'Custom app name & logo',                       free: false,   starter: false,   pro: false,       brokerage: true },
      { name: 'Brokerage brand override on all content',      free: false,   starter: false,   pro: false,       brokerage: true },
    ],
  },
  {
    name: 'Microsites & Publishing',
    features: [
      { name: 'Copy to clipboard',                            free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Auto-generated listing microsite',             free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'Microsite publish / unpublish',                free: false,   starter: true,    pro: true,        brokerage: true },
      { name: 'Microsite view analytics',                     free: false,   starter: true,    pro: true,        brokerage: true },
    ],
  },
  {
    name: 'Team & Brokerage',
    features: [
      { name: 'Team seats',                                   free: '1',     starter: '1',     pro: '3',         brokerage: '25' },
      { name: 'Agent performance dashboard',                  free: false,   starter: false,   pro: false,       brokerage: true },
      { name: 'Admin controls',                               free: false,   starter: false,   pro: false,       brokerage: true },
      { name: 'Compliance & audit logs',                      free: false,   starter: false,   pro: false,       brokerage: true },
      { name: 'CSV/PDF export of campaigns',                  free: false,   starter: false,   pro: false,       brokerage: true },
      { name: 'MLS board-wide integration',                   free: false,   starter: false,   pro: false,       brokerage: true },
    ],
  },
  {
    name: 'Performance & Support',
    features: [
      { name: 'Campaign history',                             free: false,   starter: '30 days', pro: 'Unlimited', brokerage: 'Unlimited' },
      { name: 'Priority AI generation (<30s)',                free: false,   starter: false,   pro: true,        brokerage: true },
      { name: 'Analytics dashboard',                          free: false,   starter: false,   pro: false,       brokerage: true },
      { name: 'Email support',                                free: true,    starter: true,    pro: true,        brokerage: true },
      { name: 'Priority support',                             free: false,   starter: false,   pro: true,        brokerage: true },
      { name: 'Dedicated Slack channel',                      free: false,   starter: false,   pro: false,       brokerage: true },
    ],
  },
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-amber-500 mx-auto" />
  if (value === false) return <X className="w-4 h-4 text-slate-300 mx-auto" />
  return <span className="text-xs font-medium text-slate-700">{value}</span>
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-amber-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <House className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-display font-semibold text-slate-900 text-lg">ListOps</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 transition-colors">Sign In</Link>
            <Link href="/sign-up" className="inline-flex items-center gap-1.5 bg-slate-900 text-amber-50 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
              Try Free <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-display text-5xl sm:text-6xl font-semibold text-slate-900 mb-4">
              Simple, Transparent <em>Pricing</em>
            </h1>
            <p className="text-slate-600 text-lg max-w-xl mx-auto mb-8">Start free. Upgrade when you&apos;re ready. No contracts, cancel anytime.</p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1.5">
              <button
                onClick={() => setAnnual(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Annual
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${annual ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-700'}`}>Save 28%</span>
              </button>
            </div>
          </div>

          {/* Plan Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {PLANS.map((plan) => {
              const price = annual ? Math.round((plan.yearlyPrice ?? 0) / 12) : (plan.monthlyPrice ?? 0)
              const billedAs = annual && (plan.yearlyPrice ?? 0) > 0 ? `${formatCurrency(plan.yearlyPrice ?? 0)}/yr` : null

              return (
                <div key={plan.id} className={`rounded-2xl flex flex-col relative overflow-hidden ${plan.highlighted ? 'bg-slate-900 text-white ring-2 ring-amber-400' : 'bg-white border border-slate-200'}`}>
                  {plan.badge && (
                    <div className="absolute top-4 right-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${plan.highlighted ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-700'}`}>
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-6 flex-1">
                    <div className={`font-display text-2xl font-semibold mb-1 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.name}</div>
                    <div className={`text-sm mb-5 ${plan.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>{plan.tagline}</div>

                    <div className="mb-6">
                      {plan.monthlyPrice === 0 ? (
                        <span className={`font-display text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>Free</span>
                      ) : (
                        <>
                          <span className={`font-display text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(price)}</span>
                          <span className={`text-sm ${plan.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>/mo</span>
                          {billedAs && <p className="text-xs text-amber-400 mt-1">Billed as {billedAs}</p>}
                        </>
                      )}
                    </div>

                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f.text} className={`flex items-start gap-2 text-sm ${f.included ? (plan.highlighted ? 'text-slate-200' : 'text-slate-700') : (plan.highlighted ? 'text-slate-600' : 'text-slate-300')}`}>
                          {f.included
                            ? <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${f.highlight ? 'text-amber-400' : (plan.highlighted ? 'text-amber-400' : 'text-amber-500')}`} />
                            : <X className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-40" />
                          }
                          <span className={f.highlight ? 'font-medium' : ''}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-6 pt-0">
                    <Link
                      href={plan.id === 'free' ? '/sign-up' : `/sign-up?plan=${plan.id}&billing=${annual ? 'annual' : 'monthly'}`}
                      className={`w-full block text-center font-semibold py-3 rounded-xl transition-all text-sm ${plan.highlighted ? 'bg-amber-400 text-slate-900 hover:bg-amber-300' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Full Feature Comparison Table */}
          <div className="mb-20">
            <h2 className="font-display text-3xl font-semibold text-slate-900 text-center mb-10">Full Feature Comparison</h2>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-5 bg-slate-50 border-b border-slate-200">
                <div className="p-4 text-sm font-semibold text-slate-600">Feature</div>
                {['Free', 'Starter', 'Pro', 'Brokerage'].map((name) => (
                  <div key={name} className="p-4 text-center">
                    <div className={`text-sm font-bold ${name === 'Pro' ? 'text-amber-600' : 'text-slate-900'}`}>{name}</div>
                  </div>
                ))}
              </div>

              {FEATURE_CATEGORIES.map((cat) => (
                <div key={cat.name}>
                  <div className="bg-slate-50 px-4 py-3 border-y border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{cat.name}</span>
                  </div>
                  {cat.features.map((feature, i) => (
                    <div key={feature.name} className={`grid grid-cols-5 border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <div className="p-4 text-sm text-slate-700 flex items-center">{feature.name}</div>
                      <div className="p-4 flex items-center justify-center"><FeatureValue value={feature.free} /></div>
                      <div className="p-4 flex items-center justify-center"><FeatureValue value={feature.starter} /></div>
                      <div className="p-4 flex items-center justify-center"><FeatureValue value={feature.pro} /></div>
                      <div className="p-4 flex items-center justify-center"><FeatureValue value={feature.brokerage} /></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise Card */}
          <div className="bg-slate-900 rounded-2xl p-8 sm:p-12 text-white mb-20 grain relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                <div className="max-w-xl">
                  <span className="inline-block text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full mb-4">Enterprise & MLS Partnerships</span>
                  <h3 className="font-display text-3xl font-semibold mb-3">{ENTERPRISE_PLAN.name}</h3>
                  <p className="text-slate-400 mb-6">{ENTERPRISE_PLAN.tagline}</p>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {ENTERPRISE_PLAN.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-shrink-0 text-center">
                  <div className="font-display text-4xl font-bold text-white mb-1">Custom</div>
                  <div className="text-slate-400 text-sm mb-6">Annual contract</div>
                  <Link href="/contact?type=enterprise" className="inline-flex items-center gap-2 bg-amber-400 text-slate-900 font-bold px-8 py-4 rounded-xl hover:bg-amber-300 transition-colors">
                    Contact Sales <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-3xl font-semibold text-slate-900 text-center mb-10">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: 'Does ListOps work with my MLS?',
                  a: 'We connect via SimplyRETS which covers 500+ MLS boards across the US. If your board isn\'t supported, contact us — we add new boards regularly. The app also works with demo data out of the box so you can try it before connecting your MLS.',
                },
                {
                  q: 'What exactly does each campaign include?',
                  a: 'Every campaign generates: 10 headline variations, a full MLS description, neighborhood story, SEO meta, Spanish description, 6-week Facebook calendar, 6-week Instagram calendar, Just Listed and Still Available emails, plus print materials (yard sign copy, postcard, brochure). Starter adds email drip sequences, AI photo captions, and microsite copy. Pro adds video/reel scripts, virtual tour narration, TikTok, LinkedIn, X, and Stories content.',
                },
                {
                  q: 'Can I cancel anytime?',
                  a: 'Yes. Cancel any time from your dashboard. You\'ll keep access until the end of your billing period. No cancellation fees, no questions asked.',
                },
                {
                  q: 'What is white-labeling?',
                  a: 'On Brokerage plans, you can remove all ListOps branding from every output — flyers, emails, microsites, and all copy — replacing it with your brokerage name, logo, and colors. Clients and agents only ever see your brand.',
                },
                {
                  q: 'Can multiple agents share one account?',
                  a: 'Pro includes 3 seats. Brokerage supports up to 25 agents under one account with an admin dashboard and per-agent analytics. Enterprise is unlimited.',
                },
                {
                  q: 'Is my listing data secure?',
                  a: 'Yes. We use encrypted connections to pull MLS data, store nothing longer than necessary, and never sell your data. ListOps is GDPR and CCPA compliant.',
                },
                {
                  q: 'What happens if I hit my campaign limit?',
                  a: 'You\'ll be notified and prompted to upgrade. We never auto-charge overages — you stay in control. Limits reset at the start of each billing period.',
                },
                {
                  q: 'How does AI photo captioning work?',
                  a: 'On Starter and above, we pass your actual MLS listing photos to Claude\'s vision model. It identifies each room, writes an Instagram caption based on what it literally sees, generates SEO alt text, suggests a staging improvement, and creates a Stories overlay — one set per photo.',
                },
              ].map((faq) => (
                <div key={faq.q} className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900 mb-2">{faq.q}</div>
                      <div className="text-slate-600 text-sm leading-relaxed">{faq.a}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
