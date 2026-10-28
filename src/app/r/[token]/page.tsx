import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns, sellerReports } from '@/lib/db/schema'
import { formatListingAddress, normalizeListing } from '@/lib/address'
import { resolveListingPhotos } from '@/lib/photos'
import { canAccess } from '@/lib/plans'
import { getPlanTierForUserId } from '@/lib/user-service'
import { loadEffectiveBrandKit } from '@/lib/compliance/load'
import { loadPerformance } from '@/lib/performance/load'
import { recordEvent } from '@/lib/performance/record'
import { TOKEN_RE, isBotUserAgent } from '@/lib/performance/stats'
import { DailyBars } from '@/components/performance/bar-chart'
import { PrintButton } from './print-button'

// Private link: never indexed, never referred onward.
export const metadata: Metadata = { title: 'Listing Activity Report', robots: { index: false, follow: false }, referrer: 'no-referrer' }

const SANS = 'Arial, Helvetica, sans-serif'

export default async function SellerReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!TOKEN_RE.test(token)) notFound()

  const report = await db.query.sellerReports.findFirst({ where: and(eq(sellerReports.token, token), isNull(sellerReports.revokedAt)) })
  if (!report) notFound()
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, report.campaignId), with: { listing: true, brandKit: true } })
  if (!campaign) notFound()

  const [plan, perf, bk] = await Promise.all([
    getPlanTierForUserId(campaign.agentId),
    loadPerformance(campaign.id, 30),
    loadEffectiveBrandKit(campaign.brandKit as any, campaign.agentId) as Promise<any>,
  ])
  // The link only works while the agent's plan still includes seller reports.
  if (!perf || !canAccess(plan, 'seller_report')) notFound()

  // Count a seller's open (not crawlers / link previews).
  if (!isBotUserAgent((await headers()).get('user-agent'))) {
    await Promise.all([
      db.update(sellerReports).set({ views: sql`${sellerReports.views} + 1`, lastViewedAt: new Date() }).where(eq(sellerReports.id, report.id)).catch(() => {}),
      recordEvent(campaign.id, 'report_view'),
    ])
  }

  const listing = normalizeListing(campaign.listing)
  const address = formatListingAddress(listing) || 'Your listing'
  const photo = resolveListingPhotos(campaign.listing)[0]
  const price = listing?.price ? `$${Number(listing.price).toLocaleString('en-US')}` : ''
  const primary = bk?.primaryColor ?? '#1e3a5f'
  const accent = bk?.accentColor ?? '#c9a84c'
  const showMark = !canAccess(plan, 'remove_branding')
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

  const tiles: Array<[string, string, string?]> = [
    ['Online views', perf.viewsInWindow.toLocaleString(), `last 30 days · ${perf.viewsLast7.toLocaleString()} in the last 7`],
    ['Buyer inquiries', perf.leads.total.toLocaleString(), `${perf.leads.showing} showing request${perf.leads.showing === 1 ? '' : 's'} · ${perf.leads.info} info request${perf.leads.info === 1 ? '' : 's'}`],
    ['Call / email taps', (perf.clicks.call + perf.clicks.email).toLocaleString(), `${perf.clicks.call} call · ${perf.clicks.email} email · last 30 days`],
    ['Days since launch', String(perf.campaignAgeDays), 'since this marketing campaign was created'],
  ]

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: SANS, color: '#0f172a' }}>
      <style>{`@media print { .no-print { display: none !important } body { background: white !important } .report { box-shadow: none !important } }`}</style>
      <div className="report" style={{ maxWidth: 820, margin: '0 auto', background: 'white', boxShadow: '0 1px 12px rgba(15,23,42,0.08)' }}>
        <div style={{ background: primary, color: 'white', padding: '28px 36px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent, fontWeight: 700 }}>Listing Activity Report</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{address}</div>
            <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>{[price, `Updated ${today}`].filter(Boolean).join(' · ')}</div>
          </div>
          {bk?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bk.logoUrl} alt="" style={{ height: 48, maxWidth: 140, objectFit: 'contain' }} />
          )}
        </div>

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={address} style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }} />
        )}

        <div style={{ padding: '32px 36px' }}>
          {report.note && (
            <div style={{ borderLeft: `4px solid ${accent}`, background: '#f8fafc', padding: '14px 18px', borderRadius: 8, marginBottom: 28, fontSize: 15, lineHeight: 1.6 }}>
              {report.note}
              {bk?.agentName && <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>— {bk.agentName}</div>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 32 }}>
            {tiles.map(([label, value, sub]) => (
              <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: primary }}>{value}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{label}</div>
                {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Daily online views — last 30 days</div>
          <DailyBars points={perf.views} color={primary} label="Daily online views" />

          {perf.leads.sources.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Where inquiries came from</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <tbody>
                  {perf.leads.sources.map(s => (
                    <tr key={s.source} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '8px 0' }}>{s.source}</td><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>{s.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginTop: 28 }}>
            Numbers come from this listing&apos;s own web page and are counted automatically: page views exclude search-engine and link-preview bots and the agent&apos;s own visits, and are not unique people.
            This report covers activity on the listing web page only and does not include activity on third-party sites such as MLS portals or social networks.
            {perf.trackingSince ? ` Daily tracking began ${perf.trackingSince}.` : ''}
          </p>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 14 }}>
              {bk?.agentName && <div style={{ fontWeight: 800 }}>{bk.agentName}</div>}
              <div style={{ color: '#64748b' }}>{[bk?.agentTitle, bk?.brokerageName].filter(Boolean).join(' · ')}</div>
              <div style={{ color: '#64748b' }}>{[bk?.agentPhone, bk?.agentEmail].filter(Boolean).join(' · ')}</div>
            </div>
            <PrintButton color={primary} />
          </div>
          {bk?.disclaimer && <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginTop: 16 }}>{String(bk.disclaimer)}</div>}
          {showMark && <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, letterSpacing: 1, color: '#94a3b8' }}>CREATED WITH LISTOPS</div>}
        </div>
      </div>
    </div>
  )
}
