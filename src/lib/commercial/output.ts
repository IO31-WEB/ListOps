/**
 * Turns the two raw model replies into the shapes the app stores. Lenient on formatting (trims, caps, drops junk) but strict
 * on the pieces the product needs: no teaser / one-pager / posts / emails → the generation fails and the quota is refunded.
 */
import { z } from 'zod'

const str = (max: number) => z.preprocess(v => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : ''), z.string().max(max))
const num = z.preprocess(v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : undefined }, z.number().int().min(0).max(365).optional())
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.preprocess(v => (Array.isArray(v) ? v.slice(0, max) : []), z.array(item))
const tags = list(z.preprocess(v => (typeof v === 'string' ? v.replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) : ''), z.string()), 8)
  .transform(a => a.filter(Boolean))

const OfferingReply = z.object({
  headline: str(200), headlineVariations: list(str(200), 8).transform(a => a.filter(Boolean)),
  teaser: str(1200),
  onePager: z.object({ summary: str(2000), highlights: list(str(240), 12).transform(a => a.filter(Boolean)), locationOverview: str(1500), financialSummary: str(1500).optional() }),
  narrative: str(6000),
  print: z.object({
    oneSheetHeadline: str(160), oneSheetSubhead: str(240), oneSheetBody: str(1500),
    callouts: list(z.object({ label: str(40), value: str(60) }), 8).transform(a => a.filter(c => c.label && c.value)),
    callToAction: str(300),
  }),
  micrositeCopy: z.object({
    heroHeadline: str(160), heroSubheadline: str(300), aboutHeading: str(80), aboutBody: str(3000),
    locationHeading: str(80), locationBody: str(1500), ctaHeading: str(120), ctaSubtext: str(260),
  }).partial().optional(),
  omSections: list(z.object({ title: str(80), body: str(2500) }), 10).transform(a => a.filter(s => s.title && s.body)).optional(),
})

const OutreachReply = z.object({
  linkedin: list(z.object({ week: num, theme: str(80), post: str(3000), hashtags: tags }), 12),
  facebook: list(z.object({ week: num, theme: str(80), copy: str(2000), hashtags: tags }), 12),
  emailSequence: list(z.object({ sendDay: num, purpose: str(80), subject: str(200), body: str(6000) }), 8),
})

export interface CommercialPackage {
  version: 1
  headline: string; headlineVariations: string[]; teaser: string
  onePager: { summary: string; highlights: string[]; locationOverview: string; financialSummary: string }
  narrative: string
  print: { oneSheetHeadline: string; oneSheetSubhead: string; oneSheetBody: string; callouts: Array<{ label: string; value: string }>; callToAction: string }
  omSections: Array<{ title: string; body: string }> | null
  emailSequence: Array<{ sendDay: number; purpose: string; subject: string; body: string }>
}

export interface NormalizedCommercial {
  pkg: CommercialPackage
  facebookPosts: Array<{ week: number; theme: string; copy: string; hashtags: string[] }>
  linkedin: Array<{ week: number; theme: string; post: string; hashtags: string[] }>
  micrositeCopy: Record<string, string> | null
  /** Residential-shaped copy so the microsite, approvals and seller report keep working unchanged. */
  listingCopy: Record<string, unknown>
  firstEmail: string
}

export class CommercialOutputError extends Error {}

export interface NormalizedOffering {
  headline: string; headlineVariations: string[]; teaser: string
  onePager: CommercialPackage['onePager']; narrative: string; print: CommercialPackage['print']
  omSections: CommercialPackage['omSections']; micrositeCopy: Record<string, string> | null
}
export interface NormalizedOutreach {
  linkedin: NormalizedCommercial['linkedin']; facebookPosts: NormalizedCommercial['facebookPosts']; emailSequence: CommercialPackage['emailSequence']
}

export function normalizeOffering(raw: unknown, opts: { includeOm: boolean }): NormalizedOffering {
  const o = OfferingReply.safeParse(raw)
  if (!o.success) throw new CommercialOutputError('malformed reply')
  const a = o.data
  if (!a.teaser || !a.onePager.summary || !a.narrative) throw new CommercialOutputError('missing offering copy')
  const ms = a.micrositeCopy ? Object.fromEntries(Object.entries(a.micrositeCopy).filter(([, v]) => typeof v === 'string' && v)) as Record<string, string> : null
  return {
    headline: a.headline, headlineVariations: a.headlineVariations, teaser: a.teaser,
    onePager: { summary: a.onePager.summary, highlights: a.onePager.highlights, locationOverview: a.onePager.locationOverview, financialSummary: a.onePager.financialSummary ?? '' },
    narrative: a.narrative, print: a.print,
    omSections: opts.includeOm && a.omSections && a.omSections.length > 0 ? a.omSections : null,
    micrositeCopy: ms && Object.keys(ms).length ? ms : null,
  }
}

export function normalizeOutreach(raw: unknown): NormalizedOutreach {
  const s = OutreachReply.safeParse(raw)
  if (!s.success) throw new CommercialOutputError('malformed reply')
  const b = s.data
  const linkedin = b.linkedin.filter(p => p.post).map((p, i) => ({ week: p.week ?? i + 1, theme: p.theme, post: p.post, hashtags: p.hashtags }))
  const facebookPosts = b.facebook.filter(p => p.copy).map((p, i) => ({ week: p.week ?? i + 1, theme: p.theme, copy: p.copy, hashtags: p.hashtags }))
  const emailSequence = b.emailSequence.filter(e => e.subject && e.body)
    .map((e, i) => ({ sendDay: e.sendDay ?? [0, 3, 7, 14][i] ?? 14, purpose: e.purpose, subject: e.subject, body: e.body }))
    .sort((x, y) => x.sendDay - y.sendDay)
  if (linkedin.length < 3 || facebookPosts.length < 3 || emailSequence.length < 3) throw new CommercialOutputError('missing social or email content')
  return { linkedin, facebookPosts, emailSequence }
}

/** Residential-shaped copy so the microsite, approvals and seller report keep working unchanged. */
export function toListingCopy(a: Pick<NormalizedOffering, 'headline' | 'headlineVariations' | 'teaser' | 'onePager'>): Record<string, unknown> {
  return {
    headline: a.headline, headlineVariations: a.headlineVariations, fullDescription: a.onePager.summary, bulletPoints: a.onePager.highlights,
    neighborhoodStory: a.onePager.locationOverview, seoMetaTitle: a.headline.slice(0, 70), seoMetaDescription: a.teaser.slice(0, 155),
    spanishDescription: '', toneVariants: { luxury: '', firstTimeBuyer: '', investor: '' },
  }
}

export function normalizeCommercial(offeringRaw: unknown, outreachRaw: unknown, opts: { includeOm: boolean }): NormalizedCommercial {
  const a = normalizeOffering(offeringRaw, opts)
  const b = normalizeOutreach(outreachRaw)
  const pkg: CommercialPackage = {
    version: 1,
    headline: a.headline, headlineVariations: a.headlineVariations, teaser: a.teaser,
    onePager: a.onePager, narrative: a.narrative, print: a.print, omSections: a.omSections,
    emailSequence: b.emailSequence,
  }
  return { pkg, facebookPosts: b.facebookPosts, linkedin: b.linkedin, micrositeCopy: a.micrositeCopy, listingCopy: toListingCopy(a), firstEmail: b.emailSequence[0].body }
}
