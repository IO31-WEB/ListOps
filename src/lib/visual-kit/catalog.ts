import { canAccess, type PlanTier } from '@/lib/plans'

export type KitBadge = 'justListed' | 'openHouse' | 'priceReduced'

/**
 * `slot` = which listing photo a graphic starts from (0 = first photo). Different graphics use different slots so a
 * campaign gets a mix of the uploaded photos instead of the same one or two; with fewer photos the slots wrap.
 * `photos` = how many distinct photos the graphic shows (the collage uses four).
 */
export const KIT_CATALOG = {
  'ig-square':     { label: 'Instagram Post',          desc: '1080 × 1080 — Just Listed feed post',      width: 1080, height: 1080, badge: 'justListed',   slot: 0, photos: 1 },
  'ig-feature':    { label: 'Instagram Feature Post',  desc: '1080 × 1350 — photo-forward portrait post', width: 1080, height: 1350, badge: 'justListed',   slot: 1, photos: 1 },
  'ig-collage':    { label: 'Instagram Photo Collage', desc: '1080 × 1080 — four photos, one listing',    width: 1080, height: 1080, badge: 'justListed',   slot: 2, photos: 4 },
  'ig-story':      { label: 'Instagram Story',         desc: '1080 × 1920 — Just Listed Story',          width: 1080, height: 1920, badge: 'justListed',   slot: 3, photos: 1 },
  'ig-story-2':    { label: 'Instagram Story — Photo', desc: '1080 × 1920 — full-photo Story',           width: 1080, height: 1920, badge: 'justListed',   slot: 4, photos: 1 },
  'fb-post':       { label: 'Facebook Just Listed',    desc: '1200 × 630 — link / feed graphic',         width: 1200, height: 630,  badge: 'justListed',   slot: 5, photos: 1 },
  'open-house':    { label: 'Open House',              desc: '1080 × 1080 — add date & time',            width: 1080, height: 1080, badge: 'openHouse',    slot: 1, photos: 1 },
  'price-reduced': { label: 'Price Improvement',       desc: '1080 × 1080 — shows old and new price',    width: 1080, height: 1080, badge: 'priceReduced', slot: 2, photos: 1 },
} as const satisfies Record<string, { label: string; desc: string; width: number; height: number; badge: KitBadge; slot: number; photos: number }>

export type KitKind = keyof typeof KIT_CATALOG
export const KIT_KINDS = Object.keys(KIT_CATALOG) as [KitKind, ...KitKind[]]

/** Free gets the Instagram post only (watermarked); every other graphic needs Starter+. */
export function kindAllowed(plan: PlanTier, kind: KitKind): boolean {
  return kind === 'ig-square' ? canAccess(plan, 'visual_kit') : canAccess(plan, 'visual_kit_full')
}
export const kitWatermarked = (plan: PlanTier) => !canAccess(plan, 'visual_kit_full')
export const kitPdfAllowed = (plan: PlanTier) => canAccess(plan, 'visual_kit_pdf')
