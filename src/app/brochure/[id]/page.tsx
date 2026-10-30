/**
 * Printable tri-fold brochure (letter, landscape): 11 × 8.5 in trim, 0.125 in bleed, 0.375 in safe margin.
 * Two sheets — outside (inside flap · back panel · cover) and inside (three panels) — rendered as a PDF by the same
 * headless-browser path as the flyer (page size 11.25 × 8.75 in = trim + bleed on every side), which is what
 * professional printers (VistaPrint etc.) ask for. Auth: signed-in owner, or the short-lived signed print token.
 */
import { isCommercialLocked } from '@/lib/plan-resolve'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { normalizeListing } from '@/lib/address'
import { resolveListingPhotos } from '@/lib/photos'
import { getCampaign, checkCampaignQuota } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { loadEffectiveBrandKit } from '@/lib/compliance/load'
import { SCHEME_IDS, resolvePalette, paletteAt, readableOn, accentInk } from '@/lib/color-schemes'
import { verifyPrintToken } from '@/lib/print-token'
import { hoaChip, readHoa } from '@/lib/hoa'
import { USE_TYPE_LABEL, readCommercial } from '@/lib/commercial/types'
import { encodeQr, qrPath } from '@/lib/qr/encode'
import { qrTargetUrl } from '@/lib/qr/codes'
import { getOrCreateQr } from '@/lib/qr/service'
import { BrochureToolbar } from './brochure-toolbar'

const SERIF = "var(--font-display), 'Playfair Display', Georgia, serif"
const SANS = "var(--font-body), 'DM Sans', Arial, sans-serif"
const CAPS: CSSProperties = { textTransform: 'uppercase' }

// Geometry in CSS px (96 per inch): sheet = trim + bleed on every side.
const BLEED = 12, PANEL = 352, TRIM_W = PANEL * 3, TRIM_H = 816
const SHEET_W = TRIM_W + BLEED * 2, SHEET_H = TRIM_H + BLEED * 2
const PAD_X = 36, PAD_Y = 44 // 0.375 in / 0.46 in from the trim edge — inside the printers' 0.25 in safe zone

const short = (s: string | undefined | null, max: number) => (s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const clip = (text: string, max: number) => {
  const t = short(text, 4000)
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).replace(/[.,;:\s]+$/, '') + '…'
}

/** Whole sentences only, split across panels so no panel ends mid-thought. */
function splitCopy(text: string, limits: number[]): string[] {
  const sentences = (text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).map(s => s.trim()).filter(Boolean)
  const out: string[] = limits.map(() => '')
  let i = 0
  for (const s of sentences) {
    while (i < limits.length && (out[i] + ' ' + s).trim().length > limits[i] && out[i]) i++
    if (i >= limits.length) break
    if (s.length > limits[i]) continue
    out[i] = (out[i] + ' ' + s).trim()
  }
  return out
}

export default async function BrochurePage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ scheme?: string; pt?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  // ── Load campaign: signed-in owner, OR the short-lived signed token our PDF renderer carries ──
  let campaign: Awaited<ReturnType<typeof getCampaign>> | undefined
  let planTier: Awaited<ReturnType<typeof checkCampaignQuota>>['planTier'] = 'free'
  const forPdf = Boolean(sp.pt) && verifyPrintToken(id, sp.pt)
  if (forPdf) {
    const row = await db.query.campaigns.findFirst({ where: (c, { eq: e }) => e(c.id, id), with: { listing: true, brandKit: true } })
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
  if (isCommercialLocked(campaign.campaignType, planTier)) redirect('/dashboard/commercial')

  const scheme = canAccess(planTier, 'flyer_schemes') && (SCHEME_IDS as readonly string[]).includes(sp.scheme ?? '') ? (sp.scheme as string) : 'brand'
  const listing = normalizeListing(campaign.listing)
  const cre = campaign.campaignType === 'commercial' ? readCommercial((campaign.listing as any)?.commercial) : null
  const crePrint = (campaign.analytics as any)?.commercial?.print as { oneSheetBody?: string } | undefined
  const bk = canAccess(planTier, 'brand_kit') ? await loadEffectiveBrandKit(campaign.brandKit as any, campaign.agentId) : null

  const streetAddress = listing?.address ?? 'Property Address'
  const cityState = listing ? [listing.city, listing.state].filter(Boolean).join(', ') : ''
  const priceNum = listing?.price ? Number(listing.price) : 0
  const price = cre?.priceGuidance || (priceNum ? `$${priceNum.toLocaleString()}` : '')
  const beds = listing?.bedrooms ?? 0
  const baths = listing?.bathrooms ?? 0
  const sqft = listing?.sqft?.toLocaleString() ?? ''
  const yearBuilt = (listing as any)?.yearBuilt ?? ''
  const hoaBadge = cre ? null : hoaChip(readHoa((listing as any)?.hoa))
  const features = [...(((listing as any)?.features as string[] | undefined) ?? []).map(f => short(f, 48)).filter(Boolean).slice(0, hoaBadge ? 7 : 8), ...(hoaBadge ? [hoaBadge] : [])]
  const photos = ((listing?.photos as string[]) ?? []).slice(0, 8)
  const badgeLabel = cre ? (cre.offering === 'lease' ? 'For Lease' : 'For Sale') : 'Just Listed'

  const stats = (cre ? [
    ['Property Type', USE_TYPE_LABEL[cre.useType]],
    ...(sqft ? [['Square Feet', sqft]] : []),
    ...(cre.units ? [['Units', String(cre.units)]] : []),
    ...(cre.capRatePct ? [['Cap Rate', `${cre.capRatePct}%`]] : []),
    ...(yearBuilt ? [['Year Built', String(yearBuilt)]] : []),
  ] : [
    ...(beds ? [['Bedrooms', String(beds)]] : []),
    ...(baths ? [['Bathrooms', String(baths)]] : []),
    ...(sqft ? [['Square Feet', sqft]] : []),
    ...(yearBuilt ? [['Year Built', String(yearBuilt)]] : []),
  ]).slice(0, 4) as Array<[string, string]>

  // Copy: the generated brochure copy (or the commercial one-sheet), falling back to the listing description.
  const rawCopy = (campaign.analytics as any)?.printMaterials?.brochureCopy || (cre ? crePrint?.oneSheetBody : '') || listing?.description || ''
  const [copyA, copyB] = splitCopy(String(rawCopy), [560, 520])

  const agentName = short(bk?.agentName, 60)
  const agentTitle = short(bk?.agentTitle || '', 40)
  const agentPhone = short(bk?.agentPhone, 30)
  const agentEmail = short(bk?.agentEmail, 80)
  const agentWebsite = short(bk?.agentWebsite, 80).replace(/^https?:\/\//, '')
  const brokerageName = short(bk?.brokerageName, 70)
  const tagline = short(bk?.tagline, 90)
  const disclaimer = clip(bk?.disclaimer ?? '', 420)
  const agentPhoto = bk?.agentPhotoUrl ?? ''
  const logoUrl = bk?.logoUrl ?? ''
  const brokerageLogo = bk?.brokerageLogo ?? ''
  const showMark = !canAccess(planTier, 'remove_branding')

  let qr: { path: string; dim: number } | null = null
  if (canAccess(planTier, 'qr_codes') && campaign.micrositeSlug && campaign.micrositePublished) {
    try {
      const row = await getOrCreateQr(campaign.id, campaign.agentId, 'brochure')
      const m = encodeQr(qrTargetUrl(row.code))
      qr = { path: qrPath(m, 2), dim: m.size + 4 }
    } catch (err) { console.error('[brochure] qr failed', err) }
  }

  const { primary, accent, extras, palette } = resolvePalette(scheme, bk?.primaryColor, bk?.accentColor, (bk as any)?.extraColors)
  /** i-th decorative color: accent, then the agent's extra brand colors. With no extras it is just the accent (unchanged look). */
  const tone = (i: number) => paletteAt(palette, i)
  // Accent used as TEXT on the cream/white panels must stay readable even for pastel / sand accents.
  const accentText = accentInk(accent)
  const onPrimary = readableOn(primary)
  const onAccent = readableOn(accent)
  const CREAM = '#fbf8f3'
  const INK = '#1e293b'

  // ── Building blocks ─────────────────────────────────────────────
  const photoAt = (i: number) => (photos.length ? photos[i % photos.length] : null)
  const photoBox = (i: number, h: number) => {
    const src = photoAt(i)
    return src
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={src} alt="" style={{ width: '100%', height: h, objectFit: 'cover', display: 'block' }} />
      : <div style={{ height: h, background: `linear-gradient(135deg, ${primary}, ${extras[0] ?? '#0b1220'})` }} />
  }
  const label = (text: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 24, height: 2, background: color }} />
      <div style={{ fontFamily: SANS, fontSize: 9.5, letterSpacing: 3.5, fontWeight: 700, color, ...CAPS }}>{text}</div>
    </div>
  )
  /** One panel: a full-bleed background rect (extends into the bleed on outer edges) + a content box inside the trim. */
  const panel = (i: 0 | 1 | 2, bg: string, children: ReactNode, opts: { padded?: boolean } = {}) => {
    const bgLeft = i === 0 ? 0 : BLEED + i * PANEL
    const bgWidth = PANEL + (i === 0 || i === 2 ? BLEED : 0)
    return (
      <>
        <div style={{ position: 'absolute', top: 0, height: SHEET_H, left: bgLeft, width: bgWidth, background: bg }} />
        <div style={{ position: 'absolute', top: BLEED, height: TRIM_H, left: BLEED + i * PANEL, width: PANEL, overflow: 'hidden', padding: opts.padded === false ? 0 : `${PAD_Y}px ${PAD_X}px`, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </>
    )
  }
  const folds = (
    <>
      {[BLEED + PANEL, BLEED + PANEL * 2].map(x => <div key={x} className="no-print" style={{ position: 'absolute', top: 0, bottom: 0, left: x, width: 0, borderLeft: '1px dashed rgba(100,116,139,0.55)', zIndex: 5 }} />)}
      <div className="no-print" style={{ position: 'absolute', top: BLEED, left: BLEED, width: TRIM_W, height: TRIM_H, border: '1px dashed rgba(239,68,68,0.45)', zIndex: 5, pointerEvents: 'none' }} />
    </>
  )
  const sheet = (key: string, name: string, last: boolean, children: ReactNode) => (
    <section key={key} className={last ? 'sheet-block last' : 'sheet-block'}>
      <div className="no-print sheet-label">{name}</div>
      <div className={last ? 'sheet last' : 'sheet'} style={{ position: 'relative', width: SHEET_W, height: SHEET_H, background: 'white', overflow: 'hidden', margin: '0 auto' }}>
        {children}
        {folds}
      </div>
    </section>
  )

  const contactLine = (text: string, color: string) => text && <div style={{ fontFamily: SANS, fontSize: 12.5, color, marginTop: 5, wordBreak: 'break-word' }}>{text}</div>
  const para = (text: string, color = INK) => text && <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.68, color, margin: 0 }}>{text}</p>

  // ── Sheet 1 — OUTSIDE: inside flap · back panel · front cover ──
  const flap = panel(0, CREAM, (
    <>
      {label('At a glance', accentText)}
      {stats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 0' }}>
          {stats.map(([lab, val], i) => (
            <div key={lab} style={{ width: '50%', borderLeft: `3px solid ${tone(i)}`, paddingLeft: 12 }}>
              <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: primary, lineHeight: 1.05 }}>{val}</div>
              <div style={{ fontFamily: SANS, fontSize: 8.5, letterSpacing: 2.5, color: '#64748b', marginTop: 4, ...CAPS }}>{lab}</div>
            </div>
          ))}
        </div>
      )}
      {features.length > 0 && (
        <div style={{ marginTop: 34 }}>
          {label('Highlights', accentText)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.map((f, i) => (
              <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 7, height: 7, marginTop: 6, background: tone(i), flexShrink: 0 }} />
                <div style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.45, color: INK }}>{f}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: 'auto' }}>{photoBox(1, 190)}</div>
    </>
  ))

  const back = panel(1, primary, (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 40 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl && <img src={logoUrl} alt="" style={{ height: 38, maxWidth: 120, objectFit: 'contain' }} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {brokerageLogo && <img src={brokerageLogo} alt="" style={{ height: 34, maxWidth: 110, objectFit: 'contain' }} />}
      </div>
      <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {agentPhoto && <img src={agentPhoto} alt="" style={{ width: 104, height: 104, borderRadius: 104, objectFit: 'cover', border: `3px solid ${accent}`, marginBottom: 16 }} />}
        {agentName && <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: onPrimary, lineHeight: 1.15 }}>{agentName}</div>}
        {(agentTitle || brokerageName) && <div style={{ fontFamily: SANS, fontSize: 9.5, letterSpacing: 2.5, color: accent, marginTop: 6, ...CAPS }}>{[agentTitle, brokerageName].filter(Boolean).join('  ·  ')}</div>}
        <div style={{ width: 36, height: 2, background: extras[0] ?? accent, margin: '16px 0 10px' }} />
        {contactLine(agentPhone, onPrimary)}
        {contactLine(agentEmail, onPrimary)}
        {contactLine(agentWebsite, onPrimary)}
        {tagline && <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: onPrimary, opacity: 0.8, marginTop: 14 }}>{tagline}</div>}
      </div>
      <div style={{ marginTop: 'auto' }}>
        {qr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ background: 'white', padding: 7, width: 98, height: 98, flexShrink: 0 }}>
              <svg viewBox={`0 0 ${qr.dim} ${qr.dim}`} width="84" height="84" shapeRendering="crispEdges"><path d={qr.path} fill="#000" /></svg>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 11, lineHeight: 1.5, color: onPrimary }}>Scan for more photos and full property details.</div>
          </div>
        )}
        {(disclaimer || showMark) && (
          <div style={{ fontFamily: SANS, fontSize: 7.5, lineHeight: 1.5, color: onPrimary, opacity: 0.65 }}>
            {disclaimer}{showMark && <span style={{ display: 'block', marginTop: disclaimer ? 6 : 0, letterSpacing: 1 }}>Created with ListOps</span>}
          </div>
        )}
      </div>
    </>
  ))

  const cover = (
    <>
      {/* Full-bleed cover photo across panel + bleed */}
      <div style={{ position: 'absolute', top: 0, height: SHEET_H, left: BLEED + PANEL * 2, width: PANEL + BLEED, overflow: 'hidden', background: primary }}>
        {photoAt(0)
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photoAt(0) as string} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${primary}, #0b1220)` }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,15,30,0.38) 0%, rgba(8,15,30,0) 28%, rgba(8,15,30,0.1) 48%, rgba(8,15,30,0.92) 100%)' }} />
      </div>
      <div style={{ position: 'absolute', top: BLEED, height: TRIM_H, left: BLEED + PANEL * 2, width: PANEL, padding: `${PAD_Y}px ${PAD_X}px`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ alignSelf: 'flex-start', background: accent, color: onAccent, fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 4, padding: '10px 18px', ...CAPS }}>{badgeLabel}</div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ width: 44, height: 3, background: accent, marginBottom: 16 }} />
          <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{streetAddress}</div>
          {cityState && <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.78)', marginTop: 10, ...CAPS }}>{cityState}</div>}
          {price && <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: accent, marginTop: 18 }}>{price}</div>}
        </div>
      </div>
    </>
  )

  // ── Sheet 2 — INSIDE: three panels ──
  const in1 = panel(0, 'white', (
    <>
      {label('The property', accentText)}
      <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 700, color: primary, lineHeight: 1.18, marginBottom: 16 }}>{streetAddress}</div>
      {para(copyA)}
      <div style={{ marginTop: 'auto' }}>{photoBox(2, 210)}</div>
    </>
  ))
  const in2 = panel(1, CREAM, (
    <>
      {photoBox(3, 230)}
      <div style={{ marginTop: 24 }}>{label('Make it yours', accentText)}</div>
      {para(copyB || copyA)}
      {features.length > 4 && (
        <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {features.slice(4).map((f, i) => <span key={f} style={{ fontFamily: SANS, fontSize: 10, color: primary, border: `1px solid ${tone(i + 4)}`, padding: '4px 9px' }}>{f}</span>)}
        </div>
      )}
    </>
  ))
  const in3 = panel(2, primary, (
    <>
      {photoBox(4, 250)}
      <div style={{ marginTop: 28 }}>{label('See it in person', accent)}</div>
      <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: onPrimary, lineHeight: 1.18 }}>Schedule your private tour</div>
      <div style={{ marginTop: 'auto' }}>
        {agentName && <div style={{ fontFamily: SERIF, fontSize: 19, color: onPrimary, fontWeight: 700 }}>{agentName}</div>}
        {(agentTitle || brokerageName) && <div style={{ fontFamily: SANS, fontSize: 9, letterSpacing: 2.5, color: accent, marginTop: 4, ...CAPS }}>{[agentTitle, brokerageName].filter(Boolean).join('  ·  ')}</div>}
        {contactLine(agentPhone, onPrimary)}
        {contactLine(agentEmail, onPrimary)}
      </div>
    </>
  ))

  const ZOOMS: Array<[number, number]> = [[1100, 0.9], [1000, 0.8], [900, 0.72], [800, 0.63], [700, 0.54], [600, 0.44], [500, 0.37], [420, 0.31], [360, 0.28]]

  return (
    <>
      <style>{`
        /* PRINT = exactly two pages (front, back). Two modes:
           - PDF render (?pt=): page is the full bleed sheet (11.25 x 8.75in) so the printer gets bleed.
           - Browser print: page is US Letter landscape (11 x 8.5in); the sheet is shifted by the bleed so the trim box fills the page.
           Each block is fixed-size, clips overflow and is 1px short of the page: a block exactly equal to the page height spills a
           sub-pixel sliver onto a third page in Chromium, which is what produced the multi-page preview. */
        @page { size: ${forPdf ? `${SHEET_W / 96}in ${SHEET_H / 96}in` : `${TRIM_W / 96}in ${TRIM_H / 96}in`}; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { margin: 0; padding: 0; height: auto; }
        body { background: #c8cdd4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        img { display: block; }
        .sheet-block { padding: 18px 0 8px; }
        .sheet-label { font-family: ${SANS}; font-size: 12px; font-weight: 600; color: #475569; text-align: center; margin-bottom: 10px; }
        .sheet { box-shadow: 0 8px 40px rgba(0,0,0,0.2); }
        @media print {
          html, body { background: white !important; width: auto !important; height: auto !important; }
          .no-print { display: none !important; }
          .sheet-block { padding: 0 !important; margin: 0 !important; position: relative; overflow: hidden; break-inside: avoid; page-break-inside: avoid;
            width: ${forPdf ? SHEET_W / 96 : TRIM_W / 96}in !important; height: calc(${forPdf ? SHEET_H / 96 : TRIM_H / 96}in - 1px) !important; break-after: page; page-break-after: always; }
          .sheet-block.last { break-after: auto; page-break-after: auto; }
          .sheet { position: absolute !important; left: ${forPdf ? 0 : -BLEED}px !important; top: ${forPdf ? 0 : -BLEED}px !important; width: ${SHEET_W / 96}in !important; height: ${SHEET_H / 96}in !important; zoom: 1 !important; box-shadow: none !important; margin: 0 !important; }
        }
        ${ZOOMS.map(([w, z]) => `@media screen and (max-width: ${w}px) { .sheet { zoom: ${z}; } }`).join('\n        ')}
      `}</style>

      <BrochureToolbar campaignId={id} backUrl={`/dashboard/campaigns/${id}`} planTier={planTier} initialScheme={scheme} />

      {sheet('outside', 'Page 1 — Outside (inside flap · back · cover). Dashed lines show folds and the trim edge; they do not print.', false, <>{flap}{back}{cover}</>)}
      {sheet('inside', 'Page 2 — Inside', true, <>{in1}{in2}{in3}</>)}
    </>
  )
}
