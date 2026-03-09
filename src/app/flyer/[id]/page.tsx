import { auth } from '@clerk/nextjs/server'
import { PrintButton } from './print-button'
import { redirect } from 'next/navigation'
import { getCampaign, checkCampaignQuota } from '@/lib/user-service'

export default async function FlyerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ template?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const { template = 'classic' } = await searchParams

  const [campaign, quota] = await Promise.all([
    getCampaign(id, userId),
    checkCampaignQuota(userId),
  ])
  if (!campaign) redirect('/dashboard/campaigns')

  const planTier = quota.planTier
  const listing = campaign.listing
  const address = listing
    ? [listing.address, listing.city, listing.state].filter(Boolean).join(', ')
    : 'Property Address'
  const cityState = listing ? [listing.city, listing.state].filter(Boolean).join(', ') : ''
  const streetAddress = listing?.address ?? address
  const price = listing?.price ? `$${Number(listing.price).toLocaleString()}` : ''
  const beds = listing?.bedrooms ?? 0
  const baths = listing?.bathrooms ?? 0
  const sqft = listing?.sqft?.toLocaleString() ?? ''
  const yearBuilt = (listing as any)?.yearBuilt ?? ''
  const photos = (listing?.photos as string[]) ?? []
  const description = listing?.description ?? ''
  const agentName = campaign.brandKit?.agentName ?? ''
  const agentTitle = (campaign.brandKit as any)?.agentTitle ?? 'REALTOR®'
  const agentPhone = campaign.brandKit?.agentPhone ?? ''
  const agentEmail = (campaign.brandKit as any)?.agentEmail ?? ''
  const agentPhoto = (campaign.brandKit as any)?.agentPhotoUrl ?? ''
  const logoUrl = (campaign.brandKit as any)?.logoUrl ?? ''
  const brokerageLogo = (campaign.brandKit as any)?.brokerageLogo ?? ''
  const brokerageName = (campaign.brandKit as any)?.brokerageName ?? ''
  const tagline = (campaign.brandKit as any)?.tagline ?? ''
  const primaryColor = campaign.brandKit?.primaryColor ?? '#1e3a5f'
  const accentColor = (campaign.brandKit as any)?.accentColor ?? '#c9a84c'
  const mainPhoto = photos[0] ?? null

  // Shared helpers
  const noPhoto = (h: string) => (
    <div style={{ height: h, background: 'linear-gradient(135deg,#dde3ea,#c8d0db)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const, gap: 8 }}>
      <div style={{ fontSize: 40 }}>🏡</div>
      <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 11, color: '#8fa0b0', letterSpacing: 2 }}>PROPERTY PHOTO</div>
    </div>
  )

  const agentFooter = (dark = true) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      {/* Left: headshot + agent info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {agentPhoto && (
          <img src={agentPhoto} alt={agentName} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${dark ? 'rgba(255,255,255,0.35)' : accentColor}`, flexShrink: 0 }} />
        )}
        <div>
          {agentName && <div style={{ fontFamily: 'Arial,sans-serif', fontWeight: 700, fontSize: 15, color: dark ? 'white' : primaryColor, letterSpacing: 0.3 }}>{agentName}</div>}
          {(agentTitle || brokerageName) && (
            <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 11, color: dark ? 'rgba(255,255,255,0.65)' : '#64748b', marginTop: 2 }}>
              {agentTitle}{brokerageName ? ` · ${brokerageName}` : ''}
            </div>
          )}
          <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 11, color: dark ? 'rgba(255,255,255,0.75)' : '#475569', marginTop: 3 }}>
            {[agentPhone, agentEmail].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      {/* Right: logos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {logoUrl && (
          <img src={logoUrl} alt="Agent Logo" style={{ height: 40, maxWidth: 110, objectFit: 'contain', opacity: dark ? 0.9 : 1 }} />
        )}
        {brokerageLogo && (
          <img src={brokerageLogo} alt="Brokerage Logo" style={{ height: 36, maxWidth: 100, objectFit: 'contain', opacity: dark ? 0.8 : 0.9, borderLeft: logoUrl ? `1px solid ${dark ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}` : 'none', paddingLeft: logoUrl ? 12 : 0 }} />
        )}
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; background: white; }
          .flyer-wrap { margin: 0 !important; padding: 0 !important; background: white; }
          .flyer-wrap > div { width: 8.5in !important; min-height: unset !important; max-height: 11in !important; height: 11in !important; box-shadow: none !important; overflow: hidden; page-break-after: avoid; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { margin: 0; padding: 0; height: auto; }
        .flyer-wrap > div:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; }
        @media print { html, body { height: auto; } }
        body { background: #c8cdd4; }
        img { display: block; }
      `}</style>

      <PrintButton backUrl={`/dashboard/campaigns/${id}`} planTier={planTier} initialTemplate={template} />

      <div className="flyer-wrap" style={{ paddingTop: 64, paddingBottom: 0, marginBottom: 0 }}>

        {/* ══ CLASSIC ═══════════════════════════════════════════ */}
        {template === 'classic' && (
          <div style={{ width: '8.5in', height: '11in', margin: '0 auto', background: 'white', boxShadow: '0 8px 48px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Top accent bar */}
            <div style={{ height: 6, background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }} />

            {/* Header */}
            <div style={{ background: primaryColor, padding: '28px 44px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: 24 }}>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 9, letterSpacing: 4, textTransform: 'uppercase' as const, color: accentColor, marginBottom: 8 }}>Just Listed</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{streetAddress}</div>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 5 }}>{cityState}</div>
                {tagline && <div style={{ fontFamily: 'Georgia,serif', fontSize: 12, color: accentColor, marginTop: 8, fontStyle: 'italic' }}>{tagline}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, marginBottom: 4 }}>List Price</div>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 36, fontWeight: 800, color: accentColor, lineHeight: 1 }}>{price}</div>
              </div>
            </div>

            {/* Main photo */}
            <div style={{ height: 318, overflow: 'hidden', position: 'relative' }}>
              {mainPhoto
                ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : noPhoto('318px')}
              {/* Photo overlay gradient */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, rgba(0,0,0,0.35))' }} />
            </div>

            {/* Stats bar */}
            <div style={{ background: '#f8fafc', borderBottom: `3px solid ${primaryColor}15`, padding: '16px 44px', display: 'flex', gap: 0 }}>
              {[
                { label: 'Bedrooms', value: beds || '—', icon: '🛏' },
                { label: 'Bathrooms', value: baths || '—', icon: '🚿' },
                { label: 'Square Feet', value: sqft || '—', icon: '📐' },
                ...(yearBuilt ? [{ label: 'Year Built', value: yearBuilt, icon: '🏗' }] : []),
              ].map((s, i, arr) => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRight: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                  <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 22, fontWeight: 800, color: primaryColor }}>{s.value}</div>
                  <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 9, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase' as const, marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Description + secondary photos row */}
            <div style={{ display: 'flex', flex: 1, padding: '24px 44px 20px', gap: 28 }}>
              <div style={{ flex: 1 }}>
                {/* Section label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 2, background: accentColor }} />
                  <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 9, letterSpacing: 3, color: accentColor, textTransform: 'uppercase' as const }}>About this home</div>
                </div>
                <p style={{ fontFamily: 'Georgia,serif', fontSize: 13, lineHeight: 1.9, color: '#374151' }}>
                  {description || 'Contact us for more information about this exceptional property.'}
                </p>
              </div>

              {/* Side photo stack */}
              {photos.length > 1 && (
                <div style={{ width: 160, display: 'flex', flexDirection: 'column' as const, gap: 6, flexShrink: 0 }}>
                  {photos.slice(1, 4).map((photo, i) => (
                    <img key={i} src={photo} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
                  ))}
                </div>
              )}
            </div>

            {/* Feature pills */}
            {(listing as any)?.features?.length > 0 && (
              <div style={{ padding: '0 44px 20px', display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {((listing as any).features as string[]).slice(0, 8).map((f: string) => (
                  <span key={f} style={{ fontFamily: 'Arial,sans-serif', fontSize: 10, background: `${primaryColor}12`, color: primaryColor, border: `1px solid ${primaryColor}25`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{f}</span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ background: primaryColor, padding: '18px 44px', marginTop: 'auto' }}>
              {agentFooter(true)}
            </div>

            {/* Bottom accent bar */}
            <div style={{ height: 4, background: accentColor }} />
          </div>
        )}

        {/* ══ LUXURY ════════════════════════════════════════════ */}
        {template === 'luxury' && (
          <div style={{ width: '8.5in', height: '11in', margin: '0 auto', background: '#0a1628', boxShadow: '0 8px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Hero photo with overlay */}
            <div style={{ height: 400, position: 'relative', overflow: 'hidden' }}>
              {mainPhoto
                ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75)' }} />
                : noPhoto('400px')}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,22,40,0.1) 0%, rgba(10,22,40,0.85) 100%)' }} />

              {/* Decorative corner lines */}
              <div style={{ position: 'absolute', top: 24, left: 24, width: 40, height: 40, borderTop: `2px solid ${accentColor}`, borderLeft: `2px solid ${accentColor}` }} />
              <div style={{ position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderTop: `2px solid ${accentColor}`, borderRight: `2px solid ${accentColor}` }} />

              <div style={{ position: 'absolute', bottom: 36, left: 48, right: 48 }}>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 10, letterSpacing: 5, color: accentColor, textTransform: 'uppercase' as const, marginBottom: 12 }}>Exclusively Listed</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: 10 }}>{address}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 30, fontWeight: 800, color: accentColor }}>{price}</div>
                  {tagline && <div style={{ fontFamily: 'Georgia,serif', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>— {tagline}</div>}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ borderTop: `1px solid ${accentColor}50`, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 48px', display: 'flex', gap: 0 }}>
              {[
                { label: 'Bedrooms', value: beds || '—' },
                { label: 'Bathrooms', value: baths || '—' },
                { label: 'Sq Ft', value: sqft || '—' },
                ...(yearBuilt ? [{ label: 'Year Built', value: yearBuilt }] : []),
              ].map((s, i, arr) => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none', padding: '4px 0' }}>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, color: accentColor, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Body */}
            <div style={{ display: 'flex', flex: 1, padding: '28px 48px', gap: 32 }}>
              <div style={{ flex: 1 }}>
                <div style={{ width: 36, height: 1, background: accentColor, marginBottom: 18 }} />
                <p style={{ fontFamily: 'Georgia,serif', fontSize: 13, lineHeight: 2, color: 'rgba(255,255,255,0.7)' }}>
                  {description || 'An exceptional property awaiting its discerning new owner.'}
                </p>
                {(listing as any)?.features?.length > 0 && (
                  <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    {((listing as any).features as string[]).slice(0, 6).map((f: string) => (
                      <span key={f} style={{ fontFamily: 'Arial,sans-serif', fontSize: 10, color: accentColor, border: `1px solid ${accentColor}50`, borderRadius: 2, padding: '3px 10px' }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
              {photos.length > 1 && (
                <div style={{ width: 170, display: 'flex', flexDirection: 'column' as const, gap: 6, flexShrink: 0 }}>
                  {photos.slice(1, 4).map((photo, i) => (
                    <img key={i} src={photo} alt="" style={{ width: '100%', height: 82, objectFit: 'cover', borderRadius: 4, filter: 'brightness(0.85)' }} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${accentColor}40`, padding: '20px 48px' }}>
              {agentFooter(true)}
            </div>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
          </div>
        )}

        {/* ══ MODERN ════════════════════════════════════════════ */}
        {template === 'modern' && (
          <div style={{ width: '8.5in', height: '11in', margin: '0 auto', background: 'white', boxShadow: '0 8px 48px rgba(0,0,0,0.22)', display: 'flex', overflow: 'hidden' }}>

            {/* Left — photos */}
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {mainPhoto
                  ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : noPhoto('100%')}
                {/* Tag overlay on photo */}
                <div style={{ position: 'absolute', top: 20, left: 20, background: accentColor, color: '#0f172a', fontFamily: 'Arial,sans-serif', fontSize: 9, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' as const, padding: '6px 14px' }}>
                  Just Listed
                </div>
              </div>
              {photos.length > 1 && (
                <div style={{ display: 'flex', height: 120, flexShrink: 0 }}>
                  {photos.slice(1, 3).map((photo, i) => (
                    <img key={i} src={photo} alt="" style={{ flex: 1, objectFit: 'cover', borderRight: i === 0 ? '3px solid white' : 'none' }} />
                  ))}
                </div>
              )}
            </div>

            {/* Right — content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, borderLeft: `5px solid ${primaryColor}`, overflow: 'hidden' }}>

              {/* Color top block */}
              <div style={{ background: primaryColor, padding: '32px 32px 24px' }}>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 9, letterSpacing: 3, color: `${accentColor}`, textTransform: 'uppercase' as const, marginBottom: 10 }}>For Sale</div>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 34, fontWeight: 800, color: accentColor, lineHeight: 1 }}>{price}</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 16, color: 'white', marginTop: 8, lineHeight: 1.3 }}>{streetAddress}</div>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{cityState}</div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
                {[
                  { label: 'Bedrooms', value: beds || '—' },
                  { label: 'Bathrooms', value: baths || '—' },
                  { label: 'Square Feet', value: sqft || '—' },
                  { label: 'Year Built', value: yearBuilt || '—' },
                ].map((s, i) => (
                  <div key={s.label} style={{ padding: '14px 20px', borderRight: i % 2 === 0 ? '1px solid #e2e8f0' : 'none', borderBottom: i < 2 ? '1px solid #e2e8f0' : 'none' }}>
                    <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 20, fontWeight: 800, color: primaryColor }}>{s.value}</div>
                    <div style={{ fontFamily: 'Arial,sans-serif', fontSize: 9, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase' as const, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div style={{ padding: '20px 28px', flex: 1 }}>
                <div style={{ width: 24, height: 2, background: accentColor, marginBottom: 14 }} />
                <p style={{ fontFamily: 'Georgia,serif', fontSize: 12.5, lineHeight: 1.85, color: '#475569' }}>
                  {description || 'Contact us for more information about this exceptional property.'}
                </p>
                {(listing as any)?.features?.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                    {((listing as any).features as string[]).slice(0, 6).map((f: string) => (
                      <span key={f} style={{ fontFamily: 'Arial,sans-serif', fontSize: 9, background: `${primaryColor}10`, color: primaryColor, border: `1px solid ${primaryColor}20`, borderRadius: 2, padding: '2px 8px', fontWeight: 600 }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent footer */}
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 28px', background: '#f8fafc' }}>
                {agentFooter(false)}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
