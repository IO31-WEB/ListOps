import { auth } from '@clerk/nextjs/server'
import { PrintButton } from './print-button'
import { redirect } from 'next/navigation'
import { getCampaign } from '@/lib/user-service'
import { checkCampaignQuota } from '@/lib/user-service'

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

  const campaign = await getCampaign(id, userId)
  if (!campaign) redirect('/dashboard/campaigns')

  const quota = await checkCampaignQuota(userId)
  const planTier = quota.planTier

  const listing = campaign.listing
  const address = listing
    ? [listing.address, listing.city, listing.state].filter(Boolean).join(', ')
    : 'Property Address'
  const price = listing?.price ? `$${Number(listing.price).toLocaleString()}` : ''
  const beds = listing?.bedrooms ?? 0
  const baths = listing?.bathrooms ?? 0
  const sqft = listing?.sqft?.toLocaleString() ?? ''
  const photos = (listing?.photos as string[]) ?? []
  const description = listing?.description ?? ''
  const agentName = campaign.brandKit?.agentName ?? ''
  const agentTitle = campaign.brandKit?.agentTitle ?? 'REALTOR®'
  const agentPhone = campaign.brandKit?.agentPhone ?? ''
  const agentEmail = campaign.brandKit?.agentEmail ?? ''
  const agentPhoto = campaign.brandKit?.agentPhotoUrl ?? ''
  const brokerageName = campaign.brandKit?.brokerageName ?? ''
  const tagline = campaign.brandKit?.tagline ?? ''
  const primaryColor = campaign.brandKit?.primaryColor ?? '#0f172a'
  const accentColor = campaign.brandKit?.accentColor ?? '#f59e0b'
  const mainPhoto = photos[0] ?? null

  const photoPlaceholder = (height: string, label = 'Property Photo') => (
    <div style={{ height, background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const, gap: '8px' }}>
      <div style={{ fontSize: '36px' }}>🏡</div>
      <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '12px', color: '#94a3b8', letterSpacing: '1px' }}>{label}</div>
    </div>
  )

  const agentBlock = (light = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {agentPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={agentPhoto} alt={agentName} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${light ? 'rgba(255,255,255,0.4)' : accentColor}`, flexShrink: 0 }} />
      )}
      <div>
        {agentName && <div style={{ fontFamily: 'Arial,sans-serif', fontWeight: 'bold', fontSize: '15px', color: light ? 'white' : primaryColor }}>{agentName}</div>}
        {(agentTitle || brokerageName) && <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '11px', color: light ? 'rgba(255,255,255,0.7)' : '#64748b', marginTop: '2px' }}>{agentTitle}{brokerageName ? ` · ${brokerageName}` : ''}</div>}
        {agentPhone && <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '12px', color: light ? 'rgba(255,255,255,0.85)' : '#475569', marginTop: '2px' }}>{agentPhone}{agentEmail ? ` · ${agentEmail}` : ''}</div>}
      </div>
    </div>
  )

  const statsBar = (bg: string, textColor: string, labelColor: string) => (
    <div style={{ background: bg, padding: '18px 40px', display: 'flex', gap: '48px', fontFamily: 'Arial,sans-serif' }}>
      {[
        { label: 'BEDROOMS', value: beds || '—' },
        { label: 'BATHROOMS', value: baths || '—' },
        { label: 'SQ FT', value: sqft || '—' },
      ].map(s => (
        <div key={s.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: textColor }}>{s.value}</div>
          <div style={{ fontSize: '9px', letterSpacing: '2px', color: labelColor, marginTop: '3px' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .flyer-root { margin-top: 0 !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: #e2e8f0; }
      `}</style>

      <PrintButton backUrl={`/dashboard/campaigns/${id}`} planTier={planTier} />

      {/* ── TEMPLATE: CLASSIC ──────────────────────────────────── */}
      {template === 'classic' && (
        <div className="flyer-root" style={{ width: '8.5in', minHeight: '11in', margin: '56px auto 40px', background: 'white', boxShadow: '0 4px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ background: primaryColor, color: 'white', padding: '28px 40px 24px' }}>
            <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '6px' }}>Just Listed</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '26px', fontWeight: 'bold', lineHeight: 1.2, maxWidth: '480px' }}>{address}</div>
                {tagline && <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '12px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>{tagline}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '34px', fontWeight: 'bold', color: accentColor, lineHeight: 1 }}>{price}</div>
              </div>
            </div>
          </div>

          {/* Main photo */}
          <div style={{ height: '340px', overflow: 'hidden', position: 'relative' }}>
            {mainPhoto
              ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : photoPlaceholder('340px')}
          </div>

          {/* Stats bar */}
          {statsBar('#f8fafc', primaryColor, '#94a3b8')}

          {/* Description */}
          <div style={{ padding: '24px 40px 16px', flex: 1 }}>
            <p style={{ fontFamily: 'Georgia,serif', fontSize: '13.5px', lineHeight: '1.9', color: '#374151', margin: 0 }}>
              {description || 'Contact us for more information about this exceptional property.'}
            </p>
          </div>

          {/* Secondary photo row */}
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', padding: '0 40px 24px', height: '130px' }}>
              {photos.slice(1, 4).map((photo, i) => (
                <img key={i} src={photo} alt="" style={{ flex: 1, objectFit: 'cover', borderRadius: '8px', height: '100%' }} />
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ background: primaryColor, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            {agentBlock(true)}
            <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
              Generated by CampaignAI
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATE: LUXURY ───────────────────────────────────── */}
      {template === 'luxury' && (
        <div className="flyer-root" style={{ width: '8.5in', minHeight: '11in', margin: '56px auto 40px', background: '#0c1520', boxShadow: '0 4px 40px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', position: 'relative' }}>

          {/* Full-bleed hero photo */}
          <div style={{ height: '420px', overflow: 'hidden', position: 'relative' }}>
            {mainPhoto
              ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
              : photoPlaceholder('420px')}
            {/* Gradient overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(12,21,32,0.2) 0%, rgba(12,21,32,0.8) 100%)' }} />
            {/* Text over photo */}
            <div style={{ position: 'absolute', bottom: '32px', left: '44px', right: '44px' }}>
              <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '10px', letterSpacing: '5px', color: accentColor, textTransform: 'uppercase', marginBottom: '10px' }}>Exclusively Listed</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: '30px', fontWeight: 'bold', color: 'white', lineHeight: 1.25, marginBottom: '8px' }}>{address}</div>
              <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '28px', fontWeight: 'bold', color: accentColor }}>{price}</div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderTop: `1px solid ${accentColor}40`, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '18px 44px', display: 'flex', gap: '48px' }}>
            {[{ label: 'BEDROOMS', value: beds || '—' }, { label: 'BATHROOMS', value: baths || '—' }, { label: 'SQ FT', value: sqft || '—' }].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '26px', color: accentColor, fontWeight: 'bold' }}>{s.value}</div>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ padding: '28px 44px', flex: 1 }}>
            <div style={{ width: '40px', height: '2px', background: accentColor, marginBottom: '20px' }} />
            <p style={{ fontFamily: 'Georgia,serif', fontSize: '13.5px', lineHeight: '2', color: 'rgba(255,255,255,0.75)', margin: 0 }}>
              {description || 'An exceptional property awaiting its next chapter.'}
            </p>
          </div>

          {/* Secondary photos */}
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', padding: '0 44px 28px', height: '120px' }}>
              {photos.slice(1, 4).map((photo, i) => (
                <img key={i} src={photo} alt="" style={{ flex: 1, objectFit: 'cover', borderRadius: '6px', height: '100%', opacity: 0.9 }} />
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${accentColor}60`, padding: '20px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {agentBlock(true)}
            <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', textTransform: 'uppercase' }}>CampaignAI</div>
          </div>
        </div>
      )}

      {/* ── TEMPLATE: MODERN ───────────────────────────────────── */}
      {template === 'modern' && (
        <div className="flyer-root" style={{ width: '8.5in', minHeight: '11in', margin: '56px auto 40px', background: 'white', boxShadow: '0 4px 40px rgba(0,0,0,0.15)', display: 'flex' }}>

          {/* Left column — photo(s) */}
          <div style={{ width: '52%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {mainPhoto
                ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : photoPlaceholder('100%')}
            </div>
            {photos.length > 1 && (
              <div style={{ display: 'flex', height: '140px' }}>
                {photos.slice(1, 3).map((photo, i) => (
                  <img key={i} src={photo} alt="" style={{ flex: 1, objectFit: 'cover', borderRight: i === 0 ? '3px solid white' : undefined }} />
                ))}
              </div>
            )}
          </div>

          {/* Right column — content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 36px', borderLeft: `4px solid ${primaryColor}` }}>
            {/* Tag */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: accentColor, color: '#0f172a', fontFamily: 'Arial,sans-serif', fontSize: '9px', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '4px', marginBottom: '18px', alignSelf: 'flex-start' }}>
              Just Listed
            </div>

            {/* Price */}
            <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '30px', fontWeight: 'bold', color: primaryColor, lineHeight: 1, marginBottom: '8px' }}>{price}</div>

            {/* Address */}
            <div style={{ fontFamily: 'Georgia,serif', fontSize: '18px', color: '#1e293b', lineHeight: 1.3, marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
              {address}
            </div>

            {/* Stats vertical */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              {[{ label: 'Bedrooms', value: beds }, { label: 'Bathrooms', value: baths }, { label: 'Square Feet', value: sqft }].filter(s => s.value).map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial,sans-serif', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: primaryColor }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            <p style={{ fontFamily: 'Georgia,serif', fontSize: '12.5px', lineHeight: '1.85', color: '#475569', margin: 0, flex: 1 }}>
              {description || 'Contact us for more information about this exceptional property.'}
            </p>

            {/* Agent footer */}
            <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
              {agentBlock(false)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
