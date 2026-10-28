import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { approvalRequests, approvalResponses, campaigns } from '@/lib/db/schema'
import { formatListingAddress, normalizeListing } from '@/lib/address'
import { resolveListingPhotos } from '@/lib/photos'
import { canAccess } from '@/lib/plans'
import { getPlanTierForUserId } from '@/lib/user-service'
import { loadEffectiveBrandKit } from '@/lib/compliance/load'
import { TOKEN_RE, isBotUserAgent } from '@/lib/performance/stats'
import { ApprovalForm } from './approval-form'

// Private link: never indexed, never referred onward.
export const metadata: Metadata = { title: 'Review Your Listing Marketing', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!TOKEN_RE.test(token)) notFound()
  const req = await db.query.approvalRequests.findFirst({ where: and(eq(approvalRequests.token, token), isNull(approvalRequests.revokedAt)) })
  if (!req) notFound()
  const [campaign, plan, existing] = await Promise.all([
    db.query.campaigns.findFirst({ where: eq(campaigns.id, req.campaignId), with: { listing: true, brandKit: true } }),
    getPlanTierForUserId(req.agentId),
    db.select().from(approvalResponses).where(eq(approvalResponses.requestId, req.id)),
  ])
  if (!campaign || !canAccess(plan, 'seller_approval')) notFound()
  const bk = (await loadEffectiveBrandKit(campaign.brandKit as any, campaign.agentId)) as any

  if (!isBotUserAgent((await headers()).get('user-agent'))) {
    await db.update(approvalRequests).set({ views: sql`${approvalRequests.views} + 1`, lastViewedAt: new Date() }).where(eq(approvalRequests.id, req.id)).catch(() => {})
  }

  const listing = normalizeListing(campaign.listing)
  const address = formatListingAddress(listing) || 'Your listing'
  const photo = resolveListingPhotos(campaign.listing)[0]
  const primary = bk?.primaryColor ?? '#1e3a5f'
  const accent = bk?.accentColor ?? '#c9a84c'
  const keys = new Set(req.items.map(i => i.key))
  const initial = Object.fromEntries(existing.filter(r => keys.has(r.itemKey)).map(r => [r.itemKey, { decision: r.decision, comment: r.comment ?? '' }]))
  const priorName = existing[0]?.signedName ?? req.sellerName ?? ''

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', background: 'white', boxShadow: '0 1px 12px rgba(15,23,42,0.08)' }}>
        <div style={{ background: primary, color: 'white', padding: '26px 28px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent, fontWeight: 700 }}>Please review</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{address}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Marketing prepared by {bk?.agentName || 'your agent'}</div>
          </div>
          {bk?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bk.logoUrl} alt="" style={{ height: 44, maxWidth: 130, objectFit: 'contain' }} />
          )}
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={address} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: '24px 28px 32px' }}>
          {req.note && (
            <div style={{ borderLeft: `4px solid ${accent}`, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.note}</div>
          )}
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
            Below is the marketing planned for your home. For each item, choose <strong>Approve</strong>, or <strong>Request changes</strong> and tell us what to change. Nothing is published to a new place until you have answered. You can come back to this link and change your answers until your agent closes it.
          </p>
          <ApprovalForm token={token} items={req.items} initial={initial} priorName={priorName} accent={primary} submitted={!!req.submittedAt} />
          <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #e2e8f0', fontSize: 14 }}>
            {bk?.agentName && <div style={{ fontWeight: 800 }}>{bk.agentName}</div>}
            <div style={{ color: '#64748b' }}>{[bk?.agentTitle, bk?.brokerageName].filter(Boolean).join(' · ')}</div>
            <div style={{ color: '#64748b' }}>{[bk?.agentPhone, bk?.agentEmail].filter(Boolean).join(' · ')}</div>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginTop: 16 }}>
            Your answers record that you reviewed and approved this text on the date you submit. They are a record for you and your agent, not a signature on a listing agreement or other contract. Your typed name and the time are saved with your answers; no other personal information is collected on this page.
          </p>
          {bk?.disclaimer && <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginTop: 10 }}>{String(bk.disclaimer)}</div>}
        </div>
      </div>
    </div>
  )
}
