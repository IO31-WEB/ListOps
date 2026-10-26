import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { normalizeListing } from '@/lib/address'
import { resolveListingPhotos } from '@/lib/photos'
import { getCampaign, checkCampaignQuota } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { loadEffectiveBrandKit } from '@/lib/compliance/load'
import { SCHEME_IDS, resolveScheme, luminance, readableOn } from '@/lib/color-schemes'
import { verifyPrintToken } from '@/lib/print-token'
import { PrintButton } from './print-button'
import { USE_TYPE_LABEL, readCommercial } from '@/lib/commercial/types'
import { encodeQr, qrPath } from '@/lib/qr/encode'
import { qrTargetUrl } from '@/lib/qr/codes'
import { getOrCreateQr } from '@/lib/qr/service'

// ── Typography ─────────────────────────────────────────────────
// Playfair Display + DM Sans are self-hosted (see app/layout.tsx) and exposed as CSS variables.
const SERIF = "var(--font-display), 'Playfair Display', Georgia, serif"
const SANS = "var(--font-body), 'DM Sans', Arial, sans-serif"
const CAPS: CSSProperties = { textTransform: 'uppercase' }

const TEMPLATES = ['classic', 'luxury', 'modern'] as const
const BADGES = ['justListed', 'openHouse', 'priceReduced'] as const
type Template = (typeof TEMPLATES)[number]
type Badge = (typeof BADGES)[number]

const clip = (text: string, max: number) => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).replace(/[.,;:\s]+$/, '') + '…'
}
const short = (s: string | undefined, max: number) => (s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

export default async function FlyerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ template?: string; scheme?: string; badge?: string; date?: string; time?: string; was?: string; pt?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  // ── Load campaign: signed-in owner, OR a short-lived signed token (our PDF renderer has no session) ──
  let campaign: Awaited<ReturnType<typeof getCampaign>> | undefined
  let planTier: Awaited<ReturnType<typeof checkCampaignQuota>>['planTier'] = 'free'
  if (verifyPrintToken(id, sp.pt)) {
    const row = await db.query.campaigns.findFirst({
      where: (c, { eq: e }) => e(c.id, id),
      with: { listing: true, brandKit: true },
    })
    if (row) {
      const owner = await db.query.users.findFirst({ where: eq(users.id, row.agentId) })
      campaign = { ...row, listing: row.listing ? { ...normalizeListing(row.listing), photos: resolveListingPhotos(row.listing) } : row.listing } as typeof campaign
      if (owner) planTier = (await checkCampaignQuota(owner.clerkId)).planTier
    }
  } else {
    const { userId } = await auth()
    if (!userId) redirect('/sign-in')
    const [c, quota] = await Promise.all([getCampaign(id, userId), checkCampaignQuota(userId)])
    campaign = c
    planTier = quota.planTier
  }
  if (!campaign) redirect('/dashboard/campaigns')

  // ── Server-side plan enforcement (the picker hides locked options, but URLs can be edited) ──
  const reqTemplate = (TEMPLATES as readonly string[]).includes(sp.template ?? '') ? (sp.template as Template) : 'classic'
  const template: Template = reqTemplate === 'classic' || canAccess(planTier, 'flyer_templates') ? reqTemplate : 'classic'
  const reqScheme: string = (SCHEME_IDS as readonly string[]).includes(sp.scheme ?? '') ? (sp.scheme as string) : 'brand'
  const scheme = canAccess(planTier, 'flyer_schemes') ? reqScheme : 'brand'
  const reqBadge = (BADGES as readonly string[]).includes(sp.badge ?? '') ? (sp.badge as Badge) : 'justListed'
  const badge: Badge = reqBadge === 'justListed' || canAccess(planTier, 'flyer_variants') ? reqBadge : 'justListed'
  const eventDate = short(sp.date, 40)
  const eventTime = short(sp.time, 40)

  const listing = normalizeListing(campaign.listing)
  // Brokerage compliance (locked fields + required disclaimer) is applied here, so it can't be bypassed by editing the URL.
  const bk = canAccess(planTier, 'brand_kit') ? await loadEffectiveBrandKit(campaign.brandKit as any, campaign.agentId) : null
  const address = listing ? [listing.address, listing.city, listing.state].filter(Boolean).join(', ') : 'Property Address'
  const cityState = listing ? [listing.city, listing.state].filter(Boolean).join(', ') : ''
  const streetAddress = listing?.address ?? address
  const priceNum = listing?.price ? Number(listing.price) : 0
  const price = cre?.priceGuidance || (priceNum ? `$${priceNum.toLocaleString()}` : '')
  const wasNum = /^\d+$/.test(sp.was ?? '') ? Number(sp.was) : 0
  const was = badge === 'priceReduced' && wasNum > priceNum && priceNum > 0 ? `$${wasNum.toLocaleString()}` : ''
  const beds = listing?.bedrooms ?? 0
  const baths = listing?.bathrooms ?? 0
  const sqft = listing?.sqft?.toLocaleString() ?? ''
  const yearBuilt = (listing as any)?.yearBuilt ?? ''
  const photos = ((listing?.photos as string[]) ?? []).slice(0, 6)
  const description = clip((cre ? crePrint?.oneSheetBody : '') || listing?.description || '', template === 'modern' ? 520 : 600)
  const features = (((listing as any)?.features as string[] | undefined) ?? []).slice(0, 6)

  // v13: commercial campaigns reuse these templates with CRE stats and the generated one-sheet copy (never beds/baths).
  const cre = campaign.campaignType === 'commercial' ? readCommercial((campaign.listing as any)?.commercial) : null
  const crePrint = (campaign.analytics as any)?.commercial?.print as { oneSheetBody?: string } | undefined

  const agentName = bk?.agentName ?? ''
  const agentTitle = bk?.agentTitle ?? 'REALTOR®'
  const agentPhone = bk?.agentPhone ?? ''
  const agentEmail = bk?.agentEmail ?? ''
  const agentPhoto = bk?.agentPhotoUrl ?? ''
  const logoUrl = bk?.logoUrl ?? ''
  const brokerageLogo = bk?.brokerageLogo ?? ''
  const brokerageName = bk?.brokerageName ?? ''
  const tagline = bk?.tagline ?? ''
  const disclaimer = clip(bk?.disclaimer ?? '', 260)
  const showMark = !canAccess(planTier, 'remove_branding')

  // Trackable QR (Starter+, published microsite only). Failure must never break the flyer.
  let qr: { path: string; dim: number } | null = null
  if (canAccess(planTier, 'qr_codes') && campaign.micrositeSlug && campaign.micrositePublished) {
    try {
      const row = await getOrCreateQr(campaign.id, campaign.agentId, 'flyer')
      const m = encodeQr(qrTargetUrl(row.code))
      qr = { path: qrPath(m, 2), dim: m.size + 4 }
    } catch (err) { console.error('[flyer] qr failed', err) }
  }

  const { primary: primaryColor, accent: accentColor } = resolveScheme(scheme, bk?.primaryColor, bk?.accentColor)
  const onAccent = readableOn(accentColor)
  const mainPhoto = photos[0] ?? null
  const hasEvent = badge === 'openHouse'
  const eventLine = [eventDate, eventTime].filter(Boolean).join('  ·  ') || 'Date & time to be announced'
  const badgeLabel = cre && badge === 'justListed' ? (cre.offering === 'lease' ? 'For Lease' : 'For Sale') : badge === 'openHouse' ? 'Open House' : badge === 'priceReduced' ? 'Price Improvement' : 'Just Listed'

  // ── Shared pieces ─────────────────────────────────────────────
  const noPhoto = (h: string | number) => (
    <div style={{ height: h, background: `linear-gradient(135deg, ${primaryColor}, #0b1220)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: SANS, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 4, ...CAPS }}>Photo coming soon</div>
    </div>
  )

  const priceNode = (color: string, size: number, wasColor: string, align: CSSProperties['textAlign'] = 'right') => (
    <div style={{ textAlign: align }}>
      {was && <div style={{ fontFamily: SANS, fontSize: size * 0.42, color: wasColor, textDecoration: 'line-through', marginBottom: 2 }}>{was}</div>}
      <div style={{ fontFamily: SERIF, fontSize: size, fontWeight: 700, color, lineHeight: 1, letterSpacing: -0.5 }}>{price || 'Price upon request'}</div>
    </div>
  )

  const statItems = cre ? [
    { label: 'Property Type', value: USE_TYPE_LABEL[cre.useType] },
    ...(sqft ? [{ label: 'Square Feet', value: sqft }] : []),
    ...(cre.units ? [{ label: 'Units', value: String(cre.units) }] : []),
    ...(cre.capRatePct ? [{ label: 'Cap Rate', value: `${cre.capRatePct}%` }] : []),
    ...(yearBuilt ? [{ label: 'Year Built', value: String(yearBuilt) }] : []),
  ].slice(0, 4) : [
    ...(beds ? [{ label: 'Bedrooms', value: String(beds) }] : []),
    ...(baths ? [{ label: 'Bathrooms', value: String(baths) }] : []),
    ...(sqft ? [{ label: 'Square Feet', value: sqft }] : []),
    ...(yearBuilt ? [{ label: 'Year Built', value: String(yearBuilt) }] : []),
  ]

  const eventBar = (bg: string, fg: string, accent: string) => hasEvent && (
    <div style={{ background: bg, padding: '14px 44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 5, color: accent, ...CAPS }}>Join us</div>
      <div style={{ width: 28, height: 1, background: accent }} />
      <div style={{ fontFamily: SERIF, fontSize: 19, color: fg, fontWeight: 600 }}>{eventLine}</div>
    </div>
  )

  const legal = (dark: boolean) => (disclaimer || showMark) && (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 10, fontFamily: SANS, fontSize: 8, lineHeight: 1.45, color: dark ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>
      <div style={{ flex: 1 }}>{disclaimer}</div>
      {showMark && <div style={{ flexShrink: 0, letterSpacing: 1 }}>Created with ListOps</div>}
    </div>
  )

  const agentFooter = (dark = true, compact = false) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 16, minWidth: 0, flex: 1 }}>
        {agentPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agentPhoto} alt={agentName} style={{ width: compact ? 42 : 56, height: compact ? 42 : 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${accentColor}`, flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          {agentName && <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: compact ? 14 : 17, color: dark ? 'white' : primaryColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName}</div>}
          {(agentTitle || brokerageName) && (
            <div style={{ fontFamily: SANS, fontSize: 9.5, letterSpacing: 1.5, color: dark ? 'rgba(255,255,255,0.65)' : '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...CAPS }}>
              {agentTitle}{brokerageName ? `  ·  ${brokerageName}` : ''}
            </div>
          )}
          <div style={{ fontFamily: SANS, fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.88)' : '#334155', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[agentPhone, agentEmail].filter(Boolean).join('   ·   ')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {qr && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <svg viewBox={`0 0 ${qr.dim} ${qr.dim}`} width={compact ? 66 : 84} height={compact ? 66 : 84} shapeRendering="crispEdges" role="img" aria-label="QR code: scan for photos and details" style={{ background: '#fff', borderRadius: 4, display: 'block' }}>
              <path d={qr.path} fill="#000" />
            </svg>
            <div style={{ fontFamily: SANS, fontSize: 6.5, letterSpacing: 1, marginTop: 3, color: dark ? 'rgba(255,255,255,0.75)' : '#64748b', ...CAPS }}>Scan for details</div>
          </div>
        )}
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Agent logo" style={{ height: compact ? 32 : 42, maxWidth: compact ? 80 : 110, objectFit: 'contain' }} />
        )}
        {brokerageLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brokerageLogo} alt="Brokerage logo" style={{ height: compact ? 28 : 38, maxWidth: compact ? 80 : 104, objectFit: 'contain', borderLeft: logoUrl ? `1px solid ${dark ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}` : 'none', paddingLeft: logoUrl ? 12 : 0 }} />
        )}
      </div>
    </div>
  )

  const page: CSSProperties = { width: '8.5in', height: '11in', margin: '0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }
  const sectionLabel = (text: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{ width: 30, height: 1.5, background: color }} />
      <div style={{ fontFamily: SANS, fontSize: 9, letterSpacing: 4, color, fontWeight: 700, ...CAPS }}>{text}</div>
    </div>
  )

  const inkDark = luminance(primaryColor) < 0.12 ? primaryColor : '#0b1220'

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; background: white; }
          .flyer-wrap { margin: 0 !important; padding: 0 !important; background: white; }
          .flyer-wrap > div { width: 8.5in !important; height: 11in !important; box-shadow: none !important; overflow: hidden; page-break-after: avoid; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { margin: 0; padding: 0; height: auto; }
        body { background: #c8cdd4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        img { display: block; }
      `}</style>

      <PrintButton flyerId={id} backUrl={`/dashboard/campaigns/${id}`} planTier={planTier}
        initialTemplate={template} initialScheme={scheme} initialBadge={badge}
        initialDate={eventDate} initialTime={eventTime} initialWas={wasNum ? String(wasNum) : ''} />

      <div className="flyer-wrap" style={{ paddingTop: 64 }}>

        {/* ══ CLASSIC — "Heritage": full-bleed hero, floating address card ═══════════ */}
        {template === 'classic' && (
          <div style={{ ...page, background: 'white', boxShadow: '0 8px 48px rgba(0,0,0,0.22)' }}>
            <div style={{ height: 500, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              {mainPhoto ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : noPhoto(500)}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.42) 100%)' }} />
              <div style={{ position: 'absolute', top: 34, left: 0, background: accentColor, color: onAccent, fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 4, padding: '11px 28px 11px 44px', ...CAPS }}>{badgeLabel}</div>
              {tagline && <div style={{ position: 'absolute', top: 40, right: 44, fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>{tagline}</div>}
            </div>

            <div style={{ margin: '-86px 44px 0', position: 'relative', background: 'white', padding: '26px 34px 24px', boxShadow: '0 20px 44px rgba(15,23,42,0.2)', borderTop: `4px solid ${accentColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexShrink: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 4, color: primaryColor, opacity: 0.7, marginBottom: 8, ...CAPS }}>{cityState}</div>
                <div style={{ fontFamily: SERIF, fontSize: 33, fontWeight: 700, color: primaryColor, lineHeight: 1.1 }}>{streetAddress}</div>
              </div>
              <div style={{ flexShrink: 0 }}>{priceNode(primaryColor, 36, '#94a3b8')}</div>
            </div>

            {eventBar(primaryColor, 'white', accentColor)}

            {statItems.length > 0 && (
              <div style={{ display: 'flex', margin: '22px 44px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                {statItems.map((s, i) => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '14px 0', borderRight: i < statItems.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                    <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: primaryColor }}>{s.value}</div>
                    <div style={{ fontFamily: SANS, fontSize: 8.5, letterSpacing: 3, color: '#94a3b8', marginTop: 3, ...CAPS }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flex: 1, padding: '22px 44px 14px', gap: 30, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ flex: 1 }}>
                {sectionLabel('About this home', primaryColor)}
                <p style={{ fontFamily: SERIF, fontSize: 12.5, lineHeight: 1.85, color: '#334155' }}>
                  {description || 'Contact us for more information about this exceptional property.'}
                </p>
                {features.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                    {features.map(f => (
                      <span key={f} style={{ fontFamily: SANS, fontSize: 9.5, color: primaryColor, border: `1px solid ${primaryColor}33`, borderRadius: 2, padding: '3px 9px', fontWeight: 600 }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
              {photos.length > 1 && (
                <div style={{ width: 168, display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
                  {photos.slice(1, 4).map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt="" style={{ width: '100%', height: 84, objectFit: 'cover' }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: primaryColor, padding: '18px 44px 14px', flexShrink: 0, borderTop: `3px solid ${accentColor}` }}>
              {agentFooter(true)}
              {legal(true)}
            </div>
          </div>
        )}

        {/* ══ LUXURY — "Maison": ink background, framed, centered editorial ═══════════ */}
        {template === 'luxury' && (
          <div style={{ ...page, background: inkDark, boxShadow: '0 8px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ position: 'absolute', inset: 18, border: `1px solid ${accentColor}73`, pointerEvents: 'none', zIndex: 5 }} />
            <div style={{ height: hasEvent ? 400 : 462, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              {mainPhoto ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : noPhoto('100%')}
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${inkDark}55 0%, ${inkDark}00 28%, ${inkDark}99 70%, ${inkDark} 100%)` }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, textAlign: 'center', padding: '0 60px' }}>
                <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 8, color: accentColor, marginBottom: 14, ...CAPS }}>{badge === 'justListed' ? 'Exclusively Listed' : badgeLabel}</div>
                <div style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, color: 'white', lineHeight: 1.12 }}>{streetAddress}</div>
                <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: 5, color: 'rgba(255,255,255,0.65)', marginTop: 10, ...CAPS }}>{cityState}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '8px 60px 4px', flexShrink: 0 }}>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}99)` }} />
              {priceNode(accentColor, 32, 'rgba(255,255,255,0.45)', 'center')}
              <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, transparent, ${accentColor}99)` }} />
            </div>

            {hasEvent && (
              <div style={{ textAlign: 'center', padding: '10px 60px 0', flexShrink: 0 }}>
                <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 6, color: accentColor, ...CAPS }}>Open house  </span>
                <span style={{ fontFamily: SERIF, fontSize: 17, color: 'white' }}>{eventLine}</span>
              </div>
            )}

            {statItems.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 60px 4px', flexShrink: 0 }}>
                {statItems.map((s, i) => (
                  <div key={s.label} style={{ padding: '2px 26px', textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none' }}>
                    <div style={{ fontFamily: SERIF, fontSize: 22, color: 'white', fontWeight: 600 }}>{s.value}</div>
                    <div style={{ fontFamily: SANS, fontSize: 8, letterSpacing: 3, color: 'rgba(255,255,255,0.45)', marginTop: 4, ...CAPS }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '14px 90px 0', textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, lineHeight: 1.95, color: 'rgba(255,255,255,0.78)' }}>
                {clip(description || 'An exceptional residence awaiting its next chapter.', hasEvent ? 340 : 440)}
              </p>
            </div>

            {photos.length > 2 && !hasEvent && (
              <div style={{ display: 'flex', gap: 8, padding: '16px 48px 0', flexShrink: 0 }}>
                {photos.slice(1, 4).map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p} alt="" style={{ flex: 1, minWidth: 0, height: 104, objectFit: 'cover' }} />
                ))}
              </div>
            )}

            <div style={{ marginTop: 'auto', padding: '14px 48px 24px', flexShrink: 0 }}>
              <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)`, marginBottom: 14 }} />
              {agentFooter(true)}
              {legal(true)}
            </div>
          </div>
        )}

        {/* ══ MODERN — "Atelier": split layout, bold type ═════════════════════════════ */}
        {template === 'modern' && (
          <div style={{ ...page, background: 'white', flexDirection: 'row', boxShadow: '0 8px 48px rgba(0,0,0,0.22)' }}>
            <div style={{ width: '47%', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                {mainPhoto ? <img src={mainPhoto} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : noPhoto('100%')}
                <div style={{ position: 'absolute', top: 28, left: 0, background: accentColor, color: onAccent, fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 4, padding: '9px 20px 9px 26px', ...CAPS }}>{badgeLabel}</div>
              </div>
              {photos.length > 1 && (
                <div style={{ display: 'flex', height: 150, flexShrink: 0, gap: 4, paddingTop: 4, background: 'white' }}>
                  {photos.slice(1, 3).map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt="" style={{ flex: 1, minWidth: 0, objectFit: 'cover' }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderLeft: `6px solid ${primaryColor}` }}>
              <div style={{ background: primaryColor, padding: '36px 30px 28px' }}>
                <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 5, color: accentColor, marginBottom: 14, ...CAPS }}>{badge === 'priceReduced' ? 'New price' : cre?.offering === 'lease' ? 'For lease' : 'For sale'}</div>
                {priceNode(accentColor, 40, 'rgba(255,255,255,0.5)', 'left')}
                <div style={{ fontFamily: SERIF, fontSize: 21, color: 'white', marginTop: 16, lineHeight: 1.2 }}>{streetAddress}</div>
                <div style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: 3, color: 'rgba(255,255,255,0.6)', marginTop: 6, ...CAPS }}>{cityState}</div>
              </div>

              {hasEvent && (
                <div style={{ background: accentColor, color: onAccent, padding: '12px 30px' }}>
                  <div style={{ fontFamily: SANS, fontSize: 9, letterSpacing: 4, ...CAPS }}>Open house</div>
                  <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, marginTop: 2 }}>{eventLine}</div>
                </div>
              )}

              {statItems.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0' }}>
                  {statItems.map((s, i) => (
                    <div key={s.label} style={{ width: '50%', padding: '14px 30px', borderRight: i % 2 === 0 ? '1px solid #e2e8f0' : 'none', borderTop: i > 1 ? '1px solid #e2e8f0' : 'none' }}>
                      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: primaryColor }}>{s.value}</div>
                      <div style={{ fontFamily: SANS, fontSize: 8.5, letterSpacing: 2.5, color: '#94a3b8', marginTop: 2, ...CAPS }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: '22px 30px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <div style={{ width: 28, height: 2, background: primaryColor, marginBottom: 14 }} />
                <p style={{ fontFamily: SERIF, fontSize: 12, lineHeight: 1.85, color: '#475569' }}>
                  {description || 'Contact us for more information about this exceptional property.'}
                </p>
                {features.length > 0 && (
                  <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {features.map(f => (
                      <span key={f} style={{ fontFamily: SANS, fontSize: 9, color: primaryColor, border: `1px solid ${primaryColor}30`, padding: '2px 8px', fontWeight: 600 }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 22px 10px', background: '#f8fafc', flexShrink: 0 }}>
                {agentFooter(false, true)}
                {legal(false)}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
