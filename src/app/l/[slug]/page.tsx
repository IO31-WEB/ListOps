import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { trackMicrositeViewed } from '@/lib/posthog'
import { headers } from 'next/headers'

export default async function MicrositePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.micrositeSlug, slug),
    with: { listing: true, brandKit: true },
  })

  if (!campaign || !campaign.micrositePublished) notFound()

  // Track view fire-and-forget
  db.update(campaigns)
    .set({ micrositeViews: (campaign.micrositeViews ?? 0) + 1 })
    .where(eq(campaigns.id, campaign.id))
    .catch(() => {})

  // PostHog analytics
  const hdrs = await headers()
  trackMicrositeViewed({
    campaignId: campaign.id,
    slug,
    referrer: hdrs.get('referer') ?? undefined,
  })

  const listing = campaign.listing
  const bk = campaign.brandKit as any
  const address = listing ? [listing.address, listing.city, listing.state].filter(Boolean).join(', ') : 'Property'
  const streetAddress = listing?.address ?? address
  const cityState = listing ? [listing.city, listing.state].filter(Boolean).join(', ') : ''
  const price = listing?.price ? `$${Number(listing.price).toLocaleString()}` : ''
  const beds = listing?.bedrooms ?? 0
  const baths = listing?.bathrooms ?? 0
  const sqft = listing?.sqft?.toLocaleString() ?? ''
  const photos = (listing?.photos as string[]) ?? []
  const description = listing?.description ?? ''
  const primaryColor = bk?.primaryColor ?? '#1e3a5f'
  const accentColor = bk?.accentColor ?? '#c9a84c'
  const agentName = bk?.agentName ?? ''
  const agentTitle = bk?.agentTitle ?? 'REALTOR®'
  const agentPhone = bk?.agentPhone ?? ''
  const agentEmail = bk?.agentEmail ?? ''
  const agentPhoto = bk?.agentPhotoUrl ?? ''
  const logoUrl = bk?.logoUrl ?? ''
  const brokerageLogo = bk?.brokerageLogo ?? ''
  const brokerageName = bk?.brokerageName ?? ''
  const tagline = bk?.tagline ?? ''
  const features = (listing as any)?.features as string[] | undefined

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: '#f8fafc', minHeight: '100vh', margin: 0, padding: 0 }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: '70vh', maxHeight: 600, overflow: 'hidden', background: primaryColor }}>
        {photos[0] ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]} alt={address} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.72) 100%)' }} />
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${primaryColor} 0%, #0f2444 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 72, opacity: 0.2 }}>🏡</div>
          </div>
        )}

        {/* Hero text overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 40px 44px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, letterSpacing: 5, color: accentColor, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Just Listed</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 48px)', fontWeight: 700, color: 'white', margin: '0 0 6px', lineHeight: 1.15 }}>{streetAddress}</h1>
            {cityState && <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 14 }}>{cityState}</div>}
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 800, color: accentColor }}>{price}</div>
            {tagline && <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 10, fontStyle: 'italic' }}>{tagline}</div>}
          </div>
        </div>
      </div>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 40px', display: 'flex' }}>
          {[
            { label: 'Bedrooms', value: beds },
            { label: 'Bathrooms', value: baths },
            { label: 'Square Feet', value: sqft },
          ].filter(s => s.value).map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '20px 0', borderRight: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 28, fontWeight: 800, color: primaryColor }}>{s.value}</div>
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 40px 64px' }}>

        {/* Description */}
        {description && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 36, height: 3, background: accentColor, borderRadius: 2, flexShrink: 0 }} />
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, letterSpacing: 3, color: accentColor, textTransform: 'uppercase', fontWeight: 700 }}>About This Home</div>
            </div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.9, color: '#374151', margin: 0 }}>{description}</p>
          </div>
        )}

        {/* Feature pills */}
        {features && features.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 48 }}>
            {features.slice(0, 10).map((f: string) => (
              <span key={f} style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, background: `${primaryColor}10`, color: primaryColor, border: `1px solid ${primaryColor}25`, borderRadius: 24, padding: '6px 16px', fontWeight: 600 }}>{f}</span>
            ))}
          </div>
        )}

        {/* Photo gallery — remaining photos */}
        {photos.length > 1 && (
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 36, height: 3, background: accentColor, borderRadius: 2, flexShrink: 0 }} />
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, letterSpacing: 3, color: accentColor, textTransform: 'uppercase', fontWeight: 700 }}>Photo Gallery</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {photos.slice(1, 9).map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={photo} alt={`${address} — photo ${i + 2}`}
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {(agentPhone || agentEmail) && (
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 22, fontWeight: 800, color: primaryColor, marginBottom: 8 }}>Schedule a Showing</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#64748b', marginBottom: 24, fontStyle: 'italic' }}>Homes like this don't last — contact us today.</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {agentPhone && (
                <a href={`tel:${agentPhone.replace(/\D/g, '')}`}
                  style={{ background: primaryColor, color: 'white', padding: '15px 36px', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none', fontFamily: 'Arial, sans-serif', display: 'inline-block', letterSpacing: 0.3 }}>
                  📞 {agentPhone}
                </a>
              )}
              {agentEmail && (
                <a href={`mailto:${agentEmail}?subject=Showing Request: ${address}`}
                  style={{ background: 'white', color: primaryColor, border: `2px solid ${primaryColor}`, padding: '15px 36px', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none', fontFamily: 'Arial, sans-serif', display: 'inline-block' }}>
                  ✉️ Email Agent
                </a>
              )}
            </div>
          </div>
        )}

        {/* Agent card */}
        <div style={{ background: primaryColor, borderRadius: 20, padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {agentPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agentPhoto} alt={agentName} style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
            )}
            <div>
              {agentName && <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: 800, color: 'white' }}>{agentName}</div>}
              {(agentTitle || brokerageName) && (
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
                  {agentTitle}{brokerageName ? ` · ${brokerageName}` : ''}
                </div>
              )}
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 5 }}>
                {[agentPhone, agentEmail].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          {(logoUrl || brokerageLogo) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" style={{ height: 44, maxWidth: 120, objectFit: 'contain', opacity: 0.9 }} />
              )}
              {brokerageLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brokerageLogo} alt="Brokerage" style={{ height: 38, maxWidth: 110, objectFit: 'contain', opacity: 0.8, borderLeft: logoUrl ? '1px solid rgba(255,255,255,0.2)' : 'none', paddingLeft: logoUrl ? 14 : 0 }} />
              )}
            </div>
          )}
        </div>

        {!bk?.brokerageName && (
          <div style={{ textAlign: 'center', marginTop: 40, fontFamily: 'Arial, sans-serif', fontSize: 10, color: '#e2e8f0', letterSpacing: 1 }}>
            POWERED BY CAMPAIGNAI
          </div>
        )}
      </div>
    </div>
  )
}
