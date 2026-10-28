import { describe, test, expect } from 'vitest'
import { investmentSnapshot, financingScenario, offeringReadiness } from '@/lib/commercial/metrics'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { CommercialDetailsSchema, readCommercial, factLines } from '@/lib/commercial/types'
import { normalizeCommercial, CommercialOutputError } from '@/lib/commercial/output'
import { applyCommercialSection, sectionSource, COMMERCIAL_SECTIONS } from '@/lib/commercial/regenerate'
import { canAccess } from '@/lib/plans'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const offering = {
  headline: 'Corner retail with 40 parking spaces',
  headlineVariations: ['A', 'B'],
  teaser: 'Teaser text.',
  onePager: { summary: 'Summary.', highlights: ['Corner lot', ''], locationOverview: 'Near the interchange.' },
  narrative: 'Long narrative.',
  print: { oneSheetHeadline: 'H', oneSheetSubhead: 'S', oneSheetBody: 'B', callouts: [{ label: 'SF', value: '12,000' }, { label: '', value: 'x' }], callToAction: 'Call' },
  omSections: [{ title: 'Executive Summary', body: 'Body' }],
}
const outreach = {
  linkedin: [1, 2, 3].map(w => ({ week: w, theme: 'Launch', post: `Post ${w}`, hashtags: ['#CRE', 'retail!'] })),
  facebook: [1, 2, 3].map(w => ({ week: w, theme: 'Launch', copy: `FB ${w}` })),
  emailSequence: [
    { sendDay: 7, subject: 'Third', body: 'c' }, { sendDay: 0, subject: 'First', body: 'a' }, { sendDay: 3, subject: 'Second', body: 'b' },
  ],
}

describe('commercial details', () => {
  test('use type is required; optional fields tolerate empty strings and null', () => {
    expect(CommercialDetailsSchema.safeParse({}).success).toBe(false)
    const r = CommercialDetailsSchema.safeParse({ useType: 'retail', noi: '', capRatePct: null, zoning: '' })
    expect(r.success).toBe(true)
  })
  test('readCommercial never throws on junk and returns null', () => {
    expect(readCommercial(null)).toBeNull()
    expect(readCommercial('x')).toBeNull()
    expect(readCommercial({ useType: 'spaceship' })).toBeNull()
    expect(readCommercial({ useType: 'office' })?.offering).toBe('sale')
  })
  test('factLines only states facts that were provided', () => {
    const lines = factLines({ useType: 'office', offering: 'sale' } as any, { sqft: null, price: null, yearBuilt: null }).join('\n')
    expect(lines).toMatch(/Office/)
    expect(lines).not.toMatch(/NOI|Cap rate|Zoning|Year built|Asking/)
    const full = factLines({ useType: 'retail', offering: 'lease', noi: 100000, capRatePct: 6.5 } as any, { sqft: 12000, price: 30, yearBuilt: 1999 }).join('\n')
    expect(full).toMatch(/Asking rent/)
    expect(full).toMatch(/Cap rate: 6.5%/)
  })
})

describe('commercial output normalization', () => {
  test('sorts the email sequence, strips junk, mirrors residential-shaped fields', () => {
    const n = normalizeCommercial(offering, outreach, { includeOm: true })
    expect(n.pkg.emailSequence.map(e => e.sendDay)).toEqual([0, 3, 7])
    expect(n.firstEmail).toBe('a')
    expect(n.pkg.onePager.highlights).toEqual(['Corner lot'])
    expect(n.pkg.print.callouts).toHaveLength(1)
    expect(n.linkedin[0].hashtags).toEqual(['CRE', 'retail'])
    expect(n.facebookPosts).toHaveLength(3)
    expect(n.pkg.omSections).toHaveLength(1)
  })
  test('OM sections are dropped when the plan does not include them', () => {
    expect(normalizeCommercial(offering, outreach, { includeOm: false }).pkg.omSections).toBeFalsy()
  })
  test('missing teaser / emails fails so the quota is refunded', () => {
    expect(() => normalizeCommercial({ ...offering, teaser: '' }, outreach, { includeOm: false })).toThrow(CommercialOutputError)
    expect(() => normalizeCommercial(offering, { ...outreach, emailSequence: [] }, { includeOm: false })).toThrow(CommercialOutputError)
    expect(() => normalizeCommercial(offering, { ...outreach, linkedin: [] }, { includeOm: false })).toThrow(CommercialOutputError)
    expect(() => normalizeCommercial('nope', outreach, { includeOm: false })).toThrow(CommercialOutputError)
  })
})

describe('commercial plan gates', () => {
  test('every commercial feature is Commercial and above only; Free/Starter/Pro get none', () => {
    for (const f of ['commercial_campaigns', 'commercial_om', 'commercial_underwriting', 'outreach_send'] as const) {
      for (const p of ['free', 'starter', 'pro'] as const) expect(canAccess(p, f), `${p}:${f}`).toBe(false)
      for (const p of ['commercial', 'brokerage', 'enterprise'] as const) expect(canAccess(p, f), `${p}:${f}`).toBe(true)
    }
  })
  test('server routes enforce the commercial gate', () => {
    for (const p of ['src/app/api/generate/route.ts', 'src/app/api/listings/route.ts', 'src/app/api/listings/[id]/route.ts', 'src/app/api/campaigns/[id]/regenerate/route.ts']) {
      expect(read(p), p).toMatch(/commercial_campaigns/)
    }
    for (const p of ['src/app/api/campaigns/[id]/pdf/route.ts', 'src/app/api/campaigns/[id]/visual-kit/route.ts', 'src/app/api/campaigns/[id]/microsite/route.ts', 'src/app/l/[slug]/page.tsx', 'src/app/flyer/[id]/page.tsx', 'src/app/brochure/[id]/page.tsx']) {
      expect(read(p), p).toMatch(/isCommercialLocked\(/)
    }
  })
})

describe('commercial wiring', () => {
  test('no ATTOM / site-report / grading code remains', () => {
    for (const p of ['src/app/api/commercial', 'src/lib/attom-enrichment.ts', 'src/lib/property-grader.ts', 'src/app/dashboard/commercial/[reportId]']) {
      expect(existsSync(join(process.cwd(), p)), p).toBe(false)
    }
    for (const p of ['src/app/api/generate/route.ts', 'src/lib/plans.ts', 'src/middleware.ts', 'src/lib/outreach.ts', 'src/app/dashboard/commercial/page.tsx']) {
      expect(read(p), p).not.toMatch(/attom_enrichment|site_analysis|property_grading|\/api\/commercial|attom-enrichment/)
    }
  })
  test('generate derives commercial server-side and refunds on failure; regenerate refuses commercial', () => {
    const g = read('src/app/api/generate/route.ts')
    expect(g).toMatch(/readCommercial\(/)
    expect(g).toMatch(/campaignType/)
    expect(read('src/app/api/campaigns/[id]/regenerate/route.ts')).toMatch(/commercial/)
  })
  test('outreach route is same-origin, adult-gated and plan-gated', () => {
    const r = read('src/app/api/campaigns/[id]/outreach/route.ts')
    expect(r).toMatch(/assertSameOrigin\(/)
    expect(r).toMatch(/assertAdult\(/)
    expect(r).toMatch(/outreach_send/)
    expect(read('src/lib/outreach.ts')).toMatch(/outreach_send/)
  })
  test('migration is idempotent and defaults to residential', () => {
    const m = read('drizzle/0016_commercial_campaigns.sql')
    expect(m).toMatch(/ADD COLUMN IF NOT EXISTS "campaign_type" text NOT NULL DEFAULT 'residential'/)
    expect(m).toMatch(/ADD COLUMN IF NOT EXISTS "commercial" jsonb/)
  })
  test('microsite uses broker/investor wording for commercial only', () => {
    const l = read('src/components/microsite/lead-form.tsx')
    expect(l).toMatch(/Request Information/)
    expect(l).toMatch(/Schedule a Showing/)
  })
})

describe('commercial per-section regeneration', () => {
  const base = normalizeCommercial(offering, outreach, { includeOm: true })
  const state = () => ({ facebookPosts: base.facebookPosts, analytics: { listingCopy: base.listingCopy, linkedin: base.linkedin, micrositeCopy: { heroHeadline: 'old' }, commercial: base.pkg } as Record<string, any> })
  const newOffering = { ...offering, headline: 'New headline', teaser: 'New teaser.', print: { ...offering.print, oneSheetHeadline: 'New print' }, micrositeCopy: { heroHeadline: 'New hero' }, omSections: [{ title: 'New OM', body: 'x' }] }
  const newOutreach = { linkedin: [1, 2, 3].map(w => ({ week: w, post: `New LI ${w}` })), facebook: [1, 2, 3].map(w => ({ week: w, copy: `New FB ${w}` })), emailSequence: [0, 3, 7].map(d => ({ sendDay: d, subject: `New ${d}`, body: `new body ${d}` })) }

  test('every section maps to one of the two model calls', () => {
    for (const k of COMMERCIAL_SECTIONS) expect(['offering', 'outreach'].includes(sectionSource(k))).toBe(true)
    expect(sectionSource('social')).toBe('outreach')
    expect(sectionSource('emails')).toBe('outreach')
    expect(sectionSource('print')).toBe('offering')
  })
  test('offering replaces only headline/teaser/one-pager/narrative and the residential-shaped copy', () => {
    const r = applyCommercialSection('offering', newOffering, state(), { includeOm: true })
    expect(r.analytics.commercial.teaser).toBe('New teaser.')
    expect((r.analytics.listingCopy as any).headline).toBe('New headline')
    expect(r.analytics.commercial.print.oneSheetHeadline).toBe('H')
    expect(r.analytics.commercial.emailSequence).toHaveLength(3)
    expect(r.analytics.micrositeCopy.heroHeadline).toBe('old')
    expect(Object.keys(r.core)).toEqual([])
  })
  test('print / om / microsite touch only their own field', () => {
    expect(applyCommercialSection('print', newOffering, state(), { includeOm: true }).analytics.commercial.print.oneSheetHeadline).toBe('New print')
    expect(applyCommercialSection('om', newOffering, state(), { includeOm: true }).analytics.commercial.omSections[0].title).toBe('New OM')
    const m = applyCommercialSection('microsite', newOffering, state(), { includeOm: true })
    expect(m.analytics.micrositeCopy.heroHeadline).toBe('New hero')
    expect(m.analytics.commercial.teaser).toBe('Teaser text.')
  })
  test('om without OM in the reply fails instead of wiping the existing sections', () => {
    expect(() => applyCommercialSection('om', { ...offering, omSections: [] }, state(), { includeOm: true })).toThrow()
  })
  test('social replaces LinkedIn + Facebook; emails replace the sequence and the first-email column', () => {
    const so = applyCommercialSection('social', newOutreach, state(), { includeOm: true })
    expect((so.core.facebookPosts as any)[0].copy).toBe('New FB 1')
    expect(so.analytics.linkedin[0].post).toBe('New LI 1')
    expect(so.analytics.commercial.emailSequence[0].subject).toBe('First')
    const em = applyCommercialSection('emails', newOutreach, state(), { includeOm: true })
    expect(em.core.emailJustListed).toBe('new body 0')
    expect(em.analytics.commercial.emailSequence.map((e: any) => e.sendDay)).toEqual([0, 3, 7])
    expect(em.analytics.linkedin[0].post).toBe('Post 1')
  })
  test('a bad reply throws and never returns a partial update', () => {
    expect(() => applyCommercialSection('social', { linkedin: [], facebook: [], emailSequence: [] }, state(), { includeOm: true })).toThrow(CommercialOutputError)
    expect(() => applyCommercialSection('print', { nope: 1 }, state(), { includeOm: true })).toThrow()
  })
  test('the route serves commercial sections and still rejects cross-type sections', () => {
    const r = read('src/app/api/campaigns/[id]/regenerate/route.ts')
    expect(r).toMatch(/regenerateCommercial\(/)
    expect(r).toMatch(/not available for commercial campaigns/)
    expect(r).toMatch(/commercial_om/)
  })
})

describe('commercial metrics (pure, zero-cost)', () => {
  test('snapshot math', () => {
    const rows = investmentSnapshot({ price: 5_000_000, sqft: 20_000, units: 10, noi: 350_000, capRatePct: 7 })
    const v = (l: string) => rows.find(r => r.label.startsWith(l))?.value
    expect(v('Price per SF')).toBe('$250.00')
    expect(v('Price per unit')).toBe('$500,000')
    expect(v('Implied cap rate')).toBe('7.00%')
    expect(rows.find(r => r.label.startsWith('Implied'))?.note).toBeUndefined()
  })
  test('flags a cap rate that disagrees with NOI / price', () => {
    const r = investmentSnapshot({ price: 5_000_000, noi: 250_000, capRatePct: 7 }).find(x => x.label.startsWith('Implied'))
    expect(r?.note).toMatch(/Differs/)
  })
  test('financing scenario', () => {
    const f = financingScenario({ price: 1_000_000, noi: 100_000, ltvPct: 65, ratePct: 7, amortYears: 25 })!
    expect(f.loan).toBe(650_000)
    expect(f.equity).toBe(350_000)
    expect(Math.round(f.annualDebtService)).toBe(55_129)
    expect(f.dscr).toBeGreaterThan(1.8)
    expect(financingScenario({ price: 0, noi: 1, ltvPct: 65, ratePct: 7, amortYears: 25 })).toBeNull()
    expect(financingScenario({ price: 1, noi: 1, ltvPct: 150, ratePct: 7, amortYears: 25 })).toBeNull()
  })
  test('readiness score rises as fields are filled', () => {
    const empty = offeringReadiness({ details: { useType: 'retail', offering: 'sale' } as any, photoCount: 0, descriptionLength: 0 })
    const full = offeringReadiness({ details: { useType: 'retail', offering: 'sale', noi: 1, capRatePct: 7, zoning: 'C-2', occupancyNotes: 'x', brokerRemarks: 'y' } as any, sqft: 1, price: 1, yearBuilt: 1990, photoCount: 8, descriptionLength: 400 })
    expect(empty.score).toBeLessThan(20)
    expect(full.score).toBe(100)
  })
})

describe('R2 upload', () => {
  test('PUT states Content-Length explicitly (R2 answers 411 to chunked bodies)', () => {
    const r = read('src/lib/r2.ts')
    expect(r).toMatch(/'Content-Length': String\(/)
    expect(r).toMatch(/new Uint8Array\(/)
  })
})
