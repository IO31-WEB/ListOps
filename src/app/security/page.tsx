import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Security',
  description: 'How ListOps keeps your data and listings secure.',
}

const practices = [
  { icon: '🔐', title: 'Encryption in transit & at rest', body: 'All data is encrypted using TLS 1.3 in transit and AES-256 at rest. Your listing data, brand assets, and personal information are never stored in plaintext.' },
  { icon: '🏦', title: 'Established infrastructure providers', body: 'We run on Vercel and Neon PostgreSQL, whose platforms maintain SOC 2 Type II attestations, in US-based data centers. ListOps itself has not been independently audited or certified (for example, SOC 2 or ISO 27001).' },
  { icon: '🔑', title: 'Authentication via Clerk', body: 'We use Clerk for authentication, which supports MFA, passkeys, and SSO. We never store your password — credentials are handled entirely by Clerk\'s secure systems.' },
  { icon: '💳', title: 'Payments via Stripe', body: 'All billing is processed by Stripe. ListOps never sees or stores your card number. Stripe is PCI DSS Level 1 certified.' },
  { icon: '🚫', title: 'No data selling', body: 'Your listing data, client information, and brand assets are never sold or shared with third parties for advertising purposes.' },
  { icon: '🔍', title: 'Access controls', body: 'Team features use role-based access control (owner, admin, agent, viewer). Admins control what each team member can see and do.' },
]

export default function SecurityPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <nav style={{ background: '#0f172a', padding: '16px clamp(16px, 5vw, 40px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', fontWeight: 800, fontSize: 20, textDecoration: 'none' }}>
          ListOps
        </Link>
        <Link href="/sign-up" style={{ background: '#f59e0b', color: '#0f172a', padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          Get Started
        </Link>
      </nav>

      <div style={{ background: '#0f172a', color: 'white', padding: '80px clamp(16px, 5vw, 40px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>Security</div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, margin: '0 0 20px' }}>Your data is safe with us</h1>
          <p style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
            We take security seriously. Here's exactly how we protect your listings, brand, and account.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '64px clamp(16px, 5vw, 40px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: 20, marginBottom: 48 }}>
          {practices.map(({ icon, title, body }) => (
            <div key={title} style={{ background: 'white', borderRadius: 16, padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#0f172a', borderRadius: 20, padding: 'clamp(24px, 6vw, 40px)', textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 10 }}>Found a security issue?</h2>
          <p style={{ color: '#94a3b8', marginBottom: 20, fontSize: 15 }}>We take vulnerability reports seriously. Please disclose responsibly.</p>
          <a href="mailto:security@listops.io" style={{ background: '#f59e0b', color: '#0f172a', padding: '12px 28px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
            security@listops.io
          </a>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {[['/', 'Home'], ['/about', 'About'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/contact', 'Contact']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#94a3b8', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
        © {new Date().getFullYear()} ListOps. All rights reserved.
      </footer>
    </div>
  )
}
