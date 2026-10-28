/**
 * Per-section regeneration for commercial campaigns (v13.1). Each section maps to one of the two original model calls
 * (offering or outreach); the reply is validated with the same normalizers as full generation and ONLY the requested
 * section's fields are replaced, so the rest of the package is never touched.
 */
import { normalizeOffering, normalizeOutreach, toListingCopy, type CommercialPackage } from './output'

export const COMMERCIAL_SECTIONS = ['offering', 'om', 'print', 'microsite', 'social', 'emails'] as const
export type CommercialSection = typeof COMMERCIAL_SECTIONS[number]

export const sectionSource = (s: CommercialSection): 'offering' | 'outreach' => (s === 'social' || s === 'emails' ? 'outreach' : 'offering')

export interface RegenState {
  facebookPosts: unknown
  analytics: Record<string, any>
}
export interface RegenResult {
  /** Columns on `campaigns`. */
  core: Record<string, unknown>
  /** Full replacement for `campaigns.analytics`. */
  analytics: Record<string, any>
}

export function applyCommercialSection(section: CommercialSection, raw: unknown, state: RegenState, opts: { includeOm: boolean }): RegenResult {
  const analytics = { ...state.analytics }
  const pkg = (analytics.commercial ?? null) as CommercialPackage | null
  if (!pkg) throw new Error('This campaign has no commercial package to update.')
  const next: CommercialPackage = { ...pkg }
  const core: Record<string, unknown> = {}

  if (sectionSource(section) === 'offering') {
    const a = normalizeOffering(raw, { includeOm: opts.includeOm })
    if (section === 'offering') {
      next.headline = a.headline; next.headlineVariations = a.headlineVariations; next.teaser = a.teaser
      next.onePager = a.onePager; next.narrative = a.narrative
      analytics.listingCopy = toListingCopy(a)
    } else if (section === 'print') next.print = a.print
    else if (section === 'om') {
      if (!a.omSections) throw new Error('The AI did not return OM sections. Please try again.')
      next.omSections = a.omSections
    } else if (section === 'microsite') {
      if (!a.micrositeCopy) throw new Error('The AI did not return microsite copy. Please try again.')
      analytics.micrositeCopy = a.micrositeCopy
    }
  } else {
    const b = normalizeOutreach(raw)
    if (section === 'social') { analytics.linkedin = b.linkedin; core.facebookPosts = b.facebookPosts; core.instagramPosts = [] }
    else { next.emailSequence = b.emailSequence; core.emailJustListed = b.emailSequence[0].body }
  }
  analytics.commercial = next
  return { core, analytics }
}
