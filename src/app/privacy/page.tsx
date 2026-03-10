import Link from 'next/link'
import { House } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-amber-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <House className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-display font-semibold text-slate-900 text-lg">ListOps</span>
          </Link>
        </div>
      </nav>
      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-semibold text-slate-900 mb-3">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700">
          {[
            { title: '1. Information We Collect', body: 'We collect information you provide when creating an account (name, email, brokerage details), MLS listing IDs you submit for campaign generation, brand kit assets you upload (logo, photo, colors), and usage data about how you interact with our platform. We do not collect payment card details — all payments are processed by Stripe.' },
            { title: '2. How We Use Your Information', body: 'We use your information to generate marketing campaigns for your listings, personalize AI output to your brand and writing style, send transactional emails (campaign complete, billing receipts), improve our AI models (in aggregate, anonymized form only), and provide customer support.' },
            { title: '3. MLS Data', body: 'Listing data is fetched in real time from SimplyRETS and cached temporarily to generate your campaign. We do not store listing data beyond what is needed for your campaign history. Cached listing data expires after 30 days.' },
            { title: '4. Data Sharing', body: 'We do not sell your data. We share data only with: Anthropic (Claude AI, for campaign generation), Stripe (payment processing), Clerk (authentication), Cloudflare R2 (file storage), and Neon (database hosting). All vendors are contractually bound to protect your data.' },
            { title: '5. Data Retention', body: 'Free plan: campaign history for 30 days. Paid plans: campaign history retained for the duration of your subscription plus 90 days after cancellation. You may request deletion at any time from Settings.' },
            { title: '6. GDPR & CCPA', body: 'If you are located in the EU/EEA or California, you have the right to access, correct, delete, or export your personal data. Contact privacy@listops.io to exercise these rights. We respond within 30 days.' },
            { title: '7. Security', body: 'We use HTTPS encryption for all data in transit, encrypted storage at rest, and role-based access controls. We conduct regular security reviews. Despite these measures, no system is 100% secure.' },
            { title: '8. Contact', body: 'Questions about this policy? Email privacy@listops.io or write to: ListOps, Privacy Team, [Address].' },
          ].map((section) => (
            <div key={section.title}>
              <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">{section.title}</h2>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
