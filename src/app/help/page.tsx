import Link from 'next/link'

const faqs = [
  {
    q: 'How do I generate a campaign?',
    a: 'Click "New Campaign" in the sidebar, enter your MLS listing ID, and click Generate. ListOps will create 6 weeks of Facebook posts, Instagram captions, email copy, and (on Pro) video scripts.',
  },
  {
    q: 'What MLS ID do I use?',
    a: 'Use the numeric or alphanumeric ID your MLS board assigns to each listing — typically found in your MLS portal next to the property address. If you don\'t have one, try any ID and the demo listing will be used for testing.',
  },
  {
    q: 'How do I upgrade my plan?',
    a: 'Go to Billing in the sidebar. You can upgrade to Starter ($29/mo), Pro ($79/mo), or Brokerage ($299/mo). Pro unlocks unlimited campaigns, video/reel scripts, listing microsites, and more.',
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
    a: 'A microsite is a public-facing property page with all your listing details, photos, and agent contact info. Available on Pro and above — publish it from the campaign page.',
  },
  {
    q: 'Can I use my own branding?',
    a: 'Yes — set up your Brand Kit (Starter+) with your logo, headshot, brand colors, and contact info. ListOps will apply your brand to all generated content.',
  },
  {
    q: 'How do video/reel scripts work?',
    a: 'On Pro, each campaign includes 6 word-for-word scripts optimized for Instagram Reels and TikTok — one per week theme. Each includes an opening hook, full script with scene directions, on-screen text, and a music suggestion.',
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
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
