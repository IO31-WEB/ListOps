/** Commercial (CRE) listing details: pure types + validation, shared by the form, the API and the prompts. */
import { z } from 'zod'

export const USE_TYPES = ['retail', 'office', 'industrial', 'multifamily', 'mixed_use', 'land', 'other'] as const
export type UseType = (typeof USE_TYPES)[number]
export const USE_TYPE_LABEL: Record<UseType, string> = {
  retail: 'Retail', office: 'Office', industrial: 'Industrial', multifamily: 'Multifamily', mixed_use: 'Mixed-use', land: 'Land', other: 'Other',
}
export const OFFERINGS = ['sale', 'lease'] as const
export type Offering = (typeof OFFERINGS)[number]

// Same cleaning rules as listing-schemas (control chars out, angle brackets out, whitespace collapsed).
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max))
const empty = <T extends z.ZodTypeAny>(s: T) => z.union([z.literal('').transform(() => undefined), z.null().transform(() => undefined), s]).optional()

export const CommercialDetailsSchema = z.object({
  useType: z.enum(USE_TYPES),
  offering: z.enum(OFFERINGS).default('sale'),
  units: empty(z.number().int().min(1).max(100_000)),
  lotAcres: empty(z.number().min(0).max(100_000)),
  /** Price guidance as the agent wants it shown: "$185/SF NNN", "Offers invited", "Call for pricing". */
  priceGuidance: empty(text(120)),
  noi: empty(z.number().min(0).max(5_000_000_000)),
  capRatePct: empty(z.number().min(0).max(100)),
  zoning: empty(text(80)),
  occupancyNotes: empty(text(600)),
  brokerRemarks: empty(text(2000)),
})
export type CommercialDetails = z.infer<typeof CommercialDetailsSchema>

/** Strict-enough reader for a stored JSON blob (old/foreign rows must never crash a page). */
export function readCommercial(raw: unknown): CommercialDetails | null {
  if (!raw || typeof raw !== 'object') return null
  const r = CommercialDetailsSchema.safeParse(raw)
  return r.success ? r.data : null
}

export const money = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '' : `$${Math.round(n).toLocaleString('en-US')}`)

/** The only financial/fact lines the copy may use. Anything not provided is simply absent — never estimated. */
export function factLines(c: CommercialDetails, l: { sqft?: number | null; price?: number | null; yearBuilt?: number | null }): string[] {
  const out: string[] = [`Property type: ${USE_TYPE_LABEL[c.useType]}`, `Offering: ${c.offering === 'lease' ? 'For lease' : 'For sale'}`]
  if (l.sqft) out.push(`Building size: ${l.sqft.toLocaleString('en-US')} SF`)
  if (c.units) out.push(`Units: ${c.units.toLocaleString('en-US')}`)
  if (c.lotAcres) out.push(`Land: ${c.lotAcres} acres`)
  if (l.yearBuilt) out.push(`Year built: ${l.yearBuilt}`)
  if (l.price) out.push(`${c.offering === 'lease' ? 'Asking rent' : 'Asking price'}: ${money(l.price)}`)
  if (c.priceGuidance) out.push(`Price guidance: ${c.priceGuidance}`)
  if (c.noi) out.push(`NOI: ${money(c.noi)}`)
  if (c.capRatePct) out.push(`Cap rate: ${c.capRatePct}%`)
  if (c.zoning) out.push(`Zoning / permitted use: ${c.zoning}`)
  if (c.occupancyNotes) out.push(`Occupancy / lease notes: ${c.occupancyNotes}`)
  return out
}
