import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — ListOps',
  description: 'We help real estate agents generate professional marketing campaigns in 90 seconds.',
}

export default function AboutPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{ background: '#0f172a', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', fontWeight: 800, fontSize: 20, textDecoration: 'none', letterSpacing: -0.5 }}>
          ListOps
        </Link>
        <Link href="/sign-up" style={{ background: '#f59e0b', color: '#0f172a', padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ background: '#0f172a', color: 'white', padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>About Us</div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: '0 0 20px', lineHeight: 1.15 }}>
            Built for agents who'd rather be selling
          </h1>
          <p style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
            ListOps was built out of frustration. Great agents were spending hours creating marketing content that should take minutes. We fixed that.
          </p>
        </div>
      </div>

      {/* Story */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 40px' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: '48px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>The problem we saw</h2>
          <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.8, marginBottom: 16 }}>
            The average real estate agent spends 6–8 hours per listing creating marketing content — Facebook posts, Instagram captions, email copy, print flyers. That's time not spent with clients, not spent on prospecting, not spent closing deals.
          </p>
          <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.8, marginBottom: 0 }}>
            The tools that existed were either too generic, too expensive, or required a marketing degree to use. Agents deserved something purpose-built.
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: '48px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>What we built</h2>
          <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.8, marginBottom: 16 }}>
            ListOps connects to your MLS, reads your listing, and generates a complete 6-week marketing campaign in about 90 seconds. Six content types, all on-brand, all ready to post or print.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 24 }}>
            {['Facebook Posts (6 weeks)', 'Instagram Captions', 'Just Listed Email', 'Still Available Email', 'Print-Ready Flyer', 'Listing Microsite'].map(item => (
              <div key={item} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#334155' }}>
                ✓ {item}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: '48px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 48 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>Our commitment</h2>
          <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.8, marginBottom: 16 }}>
            We're building ListOps for the long term. That means no dark patterns, no surprise charges, no selling your data. Your listing data and brand information stays yours.
          </p>
          <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.8 }}>
            We succeed when you close more deals — that's the only metric that matters to us.
          </p>
        </div>

        {/* CTA */}
        <div style={{ background: '#0f172a', borderRadius: 20, padding: '48px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 12 }}>Try it on your next listing</h2>
          <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: 16 }}>Free to start. No credit card required.</p>
          <Link href="/sign-up" style={{ background: '#f59e0b', color: '#0f172a', padding: '14px 36px', borderRadius: 12, fontWeight: 800, fontSize: 16, textDecoration: 'none', display: 'inline-block' }}>
            Get Started Free →
          </Link>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {[['/', 'Home'], ['/pricing', 'Pricing'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/contact', 'Contact']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#94a3b8', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
        © {new Date().getFullYear()} ListOps. All rights reserved.
      </footer>
    </div>
  )
}
