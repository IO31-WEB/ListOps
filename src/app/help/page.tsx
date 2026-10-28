import Link from 'next/link'
import { JsonLd } from '@/components/seo/json-ld'
import { faqLd, pageMetadata, breadcrumbLd } from '@/lib/seo'
import { PLANS } from '@/lib/plans'

export const metadata = pageMetadata({
  title: 'Help & FAQ',
  description: 'Answers about generating listing campaigns, plans and seats, team invites, microsites, flyers, branding and commercial real estate features in ListOps.',
  path: '/help',
})

const price = (id: string) => PLANS.find(p => p.id === id)?.monthlyPrice

const faqs = [
  {
    q: 'How do I generate a campaign?',
    a: 'Click "New Campaign" in the sidebar, enter your address and listing details, upload your photos, and click Generate. ListOps will create 6 weeks of Facebook posts, Instagram captions, email copy, and (on Pro) video scripts.',
  },
  {
    q: 'Do I need an MLS ID?',
    a: 'No. ListOps does not connect to any MLS. Enter the address and basics (price, beds, baths, square footage) and upload your own listing photos. You can optionally auto-fill property facts from public records — just double-check them, since public records can be out of date.',
  },
  {
    q: 'How do I upgrade my plan?',
    a: `Go to Billing in the sidebar. Plans: Starter ($${price('starter')}/mo), Pro ($${price('pro')}/mo), Commercial ($${price('commercial')}/mo) and Brokerage ($${price('brokerage')}/mo). Pro unlocks unlimited campaigns, video/reel scripts, the extended social set and seller tools. Commercial adds commercial real estate campaigns (offering memorandum sections, teaser, one-pager, investor outreach and an investment snapshot).`,
  },
  {
    q: 'How many people can use one account, and how do team invites work?',
    a: 'Free and Starter are single-seat. Pro and Commercial include 2 seats (you plus one teammate) and Brokerage includes 25. The account owner or an admin invites a teammate by email; the invite link works once, only for that email address, and expires after 7 days. Teammates share the owner\'s plan only while the owner\'s subscription is active, and pending invites count toward the seat limit.',
  },
  {
    q: 'Does ListOps support commercial real estate?',
    a: 'Yes, on the Commercial plan and above. Commercial campaigns include offering memorandum sections, a teaser, a one-pager, investor and tenant outreach drafts, and an investment snapshot calculated from the numbers you enter. ListOps does not fetch comps, market data or MLS/CoStar-style feeds.',
  },
  {
    q: 'Why is my plan still showing Free after upgrading?',
    a: 'If you updated your plan manually, visit /api/billing/sync to force a refresh. If you upgraded via Stripe, it may take a minute for the webhook to process — refresh the page.',
  },
  {
    q: 'How do I generate a PDF flyer?',
    a: 'Open any campaign and click "Generate Flyer". A print-ready page will open — use your browser\'s Print dialog (Ctrl+P / Cmd+P) and choose "Save as PDF" as the destination.',
  },
  {
    q: 'What is a listing microsite?',
    a: 'A microsite is a public-facing property page with all your listing details, photos, and agent contact info. Available on Starter and above — publish it from the campaign page.',
  },
  {
    q: 'Can I use my own branding?',
    a: 'Yes — set up your Brand Kit (Starter+) with your logo, headshot, brand colors, and contact info. ListOps will apply your brand to all generated content.',
  },
  {
    q: 'How do video/reel scripts work?',
    a: 'On Pro and above, each campaign includes 6 word-for-word scripts optimized for Instagram Reels and TikTok — one per week theme. Each includes an opening hook, full script with scene directions, on-screen text, and a music suggestion.',
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <JsonLd data={[faqLd(faqs), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Help & FAQ', path: '/help' }])]} />
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">← Dashboard</Link>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Help & FAQ</h1>
        <p className="text-slate-500 mb-10">Common questions about ListOps. Need more help? Email us at <a href="mailto:support@listops.io" className="text-amber-600 hover:underline">support@listops.io</a></p>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-2">{faq.q}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="font-semibold text-slate-900 mb-1">Still need help?</p>
          <p className="text-sm text-slate-600 mb-4">Our team typically responds within a few hours.</p>
          <a href="mailto:support@listops.io" className="inline-flex items-center gap-2 bg-slate-900 text-amber-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">
            Email Support
          </a>
        </div>
      </div>
    </div>
  )
}
