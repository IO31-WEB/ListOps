import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { KIT_CATALOG, KIT_KINDS, kindAllowed, kitPdfAllowed, kitWatermarked } from '@/lib/visual-kit/catalog'
import { renderKit } from '@/lib/visual-kit/render'
import { toDataUri, type KitData } from '@/lib/visual-kit/data'
import { resolveScheme, readableOn, COLOR_SCHEMES } from '@/lib/color-schemes'
import { signPrintToken, verifyPrintToken } from '@/lib/print-token'
import { canAccess, FEATURE_GATES } from '@/lib/plans'

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const sample: KitData = {
  street: '136 Sharp Lane', cityState: 'Elizabethton, TN', fullAddress: '136 Sharp Lane, Elizabethton, TN',
  price: '$425,000', oldPrice: '$450,000', beds: 3, baths: 2, sqft: '1,850', yearBuilt: 1998, photo: null, morePhotos: [],
  agentName: 'Alex Agent', agentTitle: 'REALTOR®', phone: '555-0100', email: 'a@example.com', website: '', brokerage: 'Example Realty', tagline: '',
  logo: null, brokerageLogo: null, headshot: null, primary: '#1a2744', accent: '#c9a84c', disclaimer: 'Each office independently owned.',
  date: 'Sat, Nov 8', time: '1–4 PM', watermark: true,
}

describe('visual kit catalog & gating', () => {
  test('eight graphics with real social dimensions; no Facebook cover', () => {
    expect(KIT_KINDS).toHaveLength(8)
    expect(KIT_KINDS).not.toContain('fb-cover')
    expect(KIT_CATALOG['ig-feature']).toMatchObject({ width: 1080, height: 1350 })
    expect(KIT_CATALOG['ig-square']).toMatchObject({ width: 1080, height: 1080 })
    expect(KIT_CATALOG['ig-story']).toMatchObject({ width: 1080, height: 1920 })
  })
  test('free: Instagram post only, watermarked, no PDF', () => {
    expect(kindAllowed('free', 'ig-square')).toBe(true)
    for (const k of KIT_KINDS.filter(k => k !== 'ig-square')) expect(kindAllowed('free', k)).toBe(false)
    expect(kitWatermarked('free')).toBe(true)
    expect(kitPdfAllowed('free')).toBe(false)
  })
  test('starter: everything, no watermark, still no PDF; pro+: PDF', () => {
    for (const k of KIT_KINDS) expect(kindAllowed('starter', k)).toBe(true)
    expect(kitWatermarked('starter')).toBe(false)
    expect(kitPdfAllowed('starter')).toBe(false)
    for (const p of ['pro', 'commercial', 'brokerage'] as const) expect(kitPdfAllowed(p)).toBe(true)
  })
  test('every plan tier is covered by the gate tables (commercial included)', () => {
    expect(canAccess('commercial', 'flyer_templates')).toBe(true)
    expect(canAccess('free', 'flyer_templates')).toBe(false)
    expect(canAccess('starter', 'flyer_schemes')).toBe(false)
    expect(canAccess('pro', 'flyer_schemes')).toBe(true)
    expect(FEATURE_GATES.visual_kit).toContain('free')
  })
})

describe('templates render without throwing', () => {
  test.each(KIT_KINDS)('%s', kind => {
    const el = renderKit(kind, sample)
    expect(el).toBeTruthy()
    expect(JSON.stringify(el)).toContain('136 Sharp Lane')
  })
  test('price improvement shows old and new price', () => {
    const json = JSON.stringify(renderKit('price-reduced', sample))
    expect(json).toContain('$450,000'); expect(json).toContain('$425,000')
  })
  test('open house shows the date and time that were supplied', () => {
    expect(JSON.stringify(renderKit('open-house', sample))).toContain('Sat, Nov 8')
  })
  test('watermark only when requested', () => {
    expect(JSON.stringify(renderKit('ig-square', sample))).toContain('Made with ListOps')
    expect(JSON.stringify(renderKit('ig-square', { ...sample, watermark: false }))).not.toContain('Made with ListOps')
  })
})

describe('images & colors', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
  test('JPEG becomes a data URI; WebP is skipped (renderer cannot draw it)', () => {
    expect(toDataUri(jpeg)).toMatch(/^data:image\/jpeg;base64,/)
    expect(toDataUri(webp)).toBeNull()
    expect(toDataUri(new Uint8Array(20))).toBeNull()
  })
  test('brand colors are used unless a scheme overrides them; bad hex falls back', () => {
    expect(resolveScheme('brand', '#112233', '#aabbcc')).toEqual({ primary: '#112233', accent: '#aabbcc' })
    expect(resolveScheme('navy', '#112233', '#aabbcc').primary).toBe('#1a2744')
    expect(resolveScheme('brand', 'red', null).primary).toBe('#1e3a5f')
    expect(COLOR_SCHEMES.length).toBe(12) // brand + 4 classic + 3 pastel + 2 earth + 2 beach
  })
  test('readable text color', () => { expect(readableOn('#ffffff')).toBe('#0f172a'); expect(readableOn('#0b1220')).toBe('#ffffff') })
})

describe('print token (PDF renderer access)', () => {
  beforeAll(() => { process.env.PRINT_TOKEN_SECRET = 'test-secret' })
  test('valid for its campaign only, rejects tampering and expiry', () => {
    const t = signPrintToken('camp-1')
    expect(verifyPrintToken('camp-1', t)).toBe(true)
    expect(verifyPrintToken('camp-2', t)).toBe(false)
    expect(verifyPrintToken('camp-1', t.slice(0, -2) + '00')).toBe(false)
    expect(verifyPrintToken('camp-1', signPrintToken('camp-1', -1000))).toBe(false)
    expect(verifyPrintToken('camp-1', undefined)).toBe(false)
    expect(verifyPrintToken('camp-1', 'garbage')).toBe(false)
  })
})

describe('flyer + routes are enforced server-side', () => {
  test('flyer page enforces template / scheme / variant gates from the plan, not the URL', () => {
    const page = src('src/app/flyer/[id]/page.tsx')
    expect(page).toMatch(/canAccess\(planTier, 'flyer_templates'\)/)
    expect(page).toMatch(/canAccess\(planTier, 'flyer_schemes'\)/)
    expect(page).toMatch(/canAccess\(planTier, 'flyer_variants'\)/)
  })
  test('visual-kit route authenticates, rate-limits, and gates plan', () => {
    const r = src('src/app/api/campaigns/[id]/visual-kit/route.ts')
    expect(r).toMatch(/requireUserId\(/); expect(r).toMatch(/rateLimitVisualKit\(/); expect(r).toMatch(/kindAllowed\(/); expect(r).toMatch(/kitPdfAllowed\(/)
  })
})
