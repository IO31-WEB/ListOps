import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Affiliate Program — ListOps',
  description: 'Earn 30% recurring commission by referring agents to ListOps.',
}

const tiers = [
  { name: 'Starter', commission: '20%', threshold: '1–10 referrals', payout: 'Monthly' },
  { name: 'Pro', commission: '25%', threshold: '11–50 referrals', payout: 'Monthly' },
  { name: 'Elite', commission: '30%', threshold: '51+ referrals', payout: 'Weekly' },
]

const faqs = [
  { q: 'How long does the cookie last?', a: '90 days. If someone clicks your link and signs up any time within 90 days, you get credit.' },
  { q: 'When do I get paid?', a: 'Commissions are paid monthly (or weekly for Elite affiliates) via PayPal or bank transfer, after a 30-day hold period.' },
  { q: 'Who can be an affiliate?', a: 'Anyone — real estate coaches, trainers, association staff, content creators, or agents who want to earn on referrals.' },
  { q: 'Is there a cap on earnings?', a: 'No. There is no cap. Refer 500 agents and earn on all of them.' },
  { q: 'Do referrals need to be on a paid plan?', a: 'Yes — commission is paid when a referred user upgrades to any paid plan (Starter, Pro, or Brokerage).' },
]

export default function AffiliatesPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <nav style={{ background: '#0f172a', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', fontWeight: 800, fontSize: 20, textDecoration: 'none' }}>
          ListOps
        </Link>
        <Link href="/sign-up" style={{ background: '#f59e0b', color: '#0f172a', padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', color: 'white', padding: '88px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>Affiliate Program</div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, margin: '0 0 20px', lineHeight: 1.15 }}>
            Earn 30% recurring commission
          </h1>
          <p style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.7, marginBottom: 36 }}>
            Refer real estate agents to ListOps and earn a percentage of their subscription every month — for as long as they stay subscribed.
          </p>
          <a href="mailto:affiliates@listops.io?subject=Affiliate Program Application" style={{ background: '#f59e0b', color: '#0f172a', padding: '16px 40px', borderRadius: 12, fontWeight: 800, fontSize: 17, textDecoration: 'none', display: 'inline-block' }}>
            Apply to Join →
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 40px' }}>
        {/* How it works */}
        <h2 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 40 }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 64 }}>
          {[
            { step: '1', title: 'Apply', body: 'Fill out a short application. We review within 2 business days.' },
            { step: '2', title: 'Share', body: 'Get your unique link. Share it with your audience — agents, brokers, coaches.' },
            { step: '3', title: 'Earn', body: 'Earn recurring commission every month a referred agent stays subscribed.' },
          ].map(({ step, title, body }) => (
            <div key={step} style={{ background: 'white', borderRadius: 16, padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ width: 44, height: 44, background: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 800, fontSize: 18, color: '#0f172a' }}>{step}</div>
              <h3 style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8, fontSize: 18 }}>{title}</h3>
              <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Commission tiers */}
        <h2 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 32 }}>Commission tiers</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 64 }}>
          {tiers.map((tier, i) => (
            <div key={tier.name} style={{ background: i === 2 ? '#0f172a' : 'white', borderRadius: 16, padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: i === 2 ? 'none' : '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: i === 2 ? '#f59e0b' : '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>{tier.name}</div>
              <div style={{ fontSize: 44, fontWeight: 800, color: i === 2 ? '#f59e0b' : '#0f172a', marginBottom: 4 }}>{tier.commission}</div>
              <div style={{ fontSize: 13, color: i === 2 ? '#94a3b8' : '#64748b', marginBottom: 16 }}>recurring commission</div>
              <div style={{ fontSize: 13, color: i === 2 ? '#cbd5e1' : '#475569' }}>{tier.threshold}</div>
              <div style={{ fontSize: 13, color: i === 2 ? '#cbd5e1' : '#475569', marginTop: 4 }}>Payout: {tier.payout}</div>
            </div>
          ))}
        </div>

        {/* FAQs */}
        <h2 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 32 }}>FAQ</h2>
        <div style={{ marginBottom: 56 }}>
          {faqs.map(({ q, a }) => (
            <div key={q} style={{ background: 'white', borderRadius: 14, padding: '24px 28px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8, fontSize: 16 }}>{q}</h3>
              <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ background: '#0f172a', borderRadius: 20, padding: '48px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: 'white', marginBottom: 12 }}>Ready to start earning?</h2>
          <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: 16 }}>Email us to apply. We'll get back to you within 2 business days.</p>
          <a href="mailto:affiliates@listops.io?subject=Affiliate Program Application" style={{ background: '#f59e0b', color: '#0f172a', padding: '14px 36px', borderRadius: 12, fontWeight: 800, fontSize: 16, textDecoration: 'none', display: 'inline-block' }}>
            Apply Now →
          </a>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {[['/', 'Home'], ['/about', 'About'], ['/pricing', 'Pricing'], ['/privacy', 'Privacy'], ['/contact', 'Contact']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#94a3b8', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
        © {new Date().getFullYear()} ListOps. All rights reserved.
      </footer>
    </div>
  )
}
