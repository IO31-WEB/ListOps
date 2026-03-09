import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'GDPR & Privacy Rights — CampaignAI',
  description: 'Your rights under GDPR and how CampaignAI handles personal data.',
}

export default function GdprPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <nav style={{ background: '#0f172a', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', fontWeight: 800, fontSize: 20, textDecoration: 'none' }}>
          Campaign<span style={{ color: '#f59e0b' }}>AI</span>
        </Link>
        <Link href="/sign-up" style={{ background: '#f59e0b', color: '#0f172a', padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          Get Started
        </Link>
      </nav>

      <div style={{ background: '#0f172a', color: 'white', padding: '72px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>GDPR</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '0 0 16px' }}>Your Privacy Rights</h1>
          <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.7 }}>
            Under the General Data Protection Regulation (GDPR) and applicable privacy laws, you have rights over your personal data. Here's what they are and how to exercise them.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 40px' }}>
        {[
          { title: 'Right to Access', body: 'You have the right to request a copy of all personal data we hold about you. This includes your account information, usage history, and any content generated using your data. To request a data export, email us at privacy@getcampaignai.com.' },
          { title: 'Right to Rectification', body: 'If any personal data we hold is inaccurate or incomplete, you have the right to have it corrected. You can update most information directly in your account Settings page, or contact us for other changes.' },
          { title: 'Right to Erasure ("Right to be Forgotten")', body: 'You can request that we delete all personal data associated with your account. Note that we may retain certain data where required by law (e.g., billing records). To request account deletion, go to Settings → Delete Account or email us.' },
          { title: 'Right to Data Portability', body: 'You have the right to receive your data in a structured, machine-readable format (JSON or CSV). Contact us at privacy@getcampaignai.com to request a portable data export.' },
          { title: 'Right to Object', body: 'You can object to processing of your personal data for direct marketing purposes at any time. You can unsubscribe from marketing emails via the unsubscribe link in any email, or by contacting us directly.' },
          { title: 'Right to Restrict Processing', body: 'In certain circumstances you can request that we limit how we process your data — for example, while a dispute about accuracy is being resolved.' },
          { title: 'Lawful Basis for Processing', body: 'We process your data on the basis of contract performance (providing the service you signed up for), legitimate interests (fraud prevention, security), and consent (marketing communications). We do not sell personal data.' },
        ].map(({ title, body }) => (
          <div key={title} style={{ background: 'white', borderRadius: 16, padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{title}</h2>
            <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.75, margin: 0 }}>{body}</p>
          </div>
        ))}

        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 16, padding: '28px 32px', marginTop: 8, marginBottom: 40 }}>
          <h3 style={{ fontWeight: 700, color: '#92400e', marginBottom: 8 }}>How to exercise your rights</h3>
          <p style={{ fontSize: 15, color: '#78350f', lineHeight: 1.7, margin: 0 }}>
            Email <a href="mailto:privacy@getcampaignai.com" style={{ color: '#d97706', fontWeight: 600 }}>privacy@getcampaignai.com</a> with your request. We will respond within 30 days. You also have the right to lodge a complaint with your local data protection authority.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            For full details on how we handle your data, see our <Link href="/privacy" style={{ color: '#f59e0b', fontWeight: 600 }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {[['/', 'Home'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/security', 'Security'], ['/contact', 'Contact']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#94a3b8', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
        © {new Date().getFullYear()} CampaignAI. All rights reserved.
      </footer>
    </div>
  )
}
