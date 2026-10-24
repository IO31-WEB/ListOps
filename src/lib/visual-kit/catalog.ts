import { canAccess, type PlanTier } from '@/lib/plans'

export type KitBadge = 'justListed' | 'openHouse' | 'priceReduced'

export const KIT_CATALOG = {
  'ig-square':     { label: 'Instagram Post',      desc: '1080 × 1080 — feed post',                 width: 1080, height: 1080, badge: 'justListed' },
  'ig-story':      { label: 'Instagram Story',     desc: '1080 × 1920 — Story / Reel cover',        width: 1080, height: 1920, badge: 'justListed' },
  'fb-post':       { label: 'Facebook Just Listed', desc: '1200 × 630 — link / feed graphic',       width: 1200, height: 630,  badge: 'justListed' },
  'fb-cover':      { label: 'Facebook Cover',      desc: '1640 × 624 — page / event cover',         width: 1640, height: 624,  badge: 'justListed' },
  'open-house':    { label: 'Open House',          desc: '1080 × 1080 — add date & time',           width: 1080, height: 1080, badge: 'openHouse' },
  'price-reduced': { label: 'Price Improvement',   desc: '1080 × 1080 — shows old and new price',   width: 1080, height: 1080, badge: 'priceReduced' },
} as const satisfies Record<string, { label: string; desc: string; width: number; height: number; badge: KitBadge }>

export type KitKind = keyof typeof KIT_CATALOG
export const KIT_KINDS = Object.keys(KIT_CATALOG) as [KitKind, ...KitKind[]]

/** Free gets the Instagram post only (watermarked); every other graphic needs Starter+. */
export function kindAllowed(plan: PlanTier, kind: KitKind): boolean {
  return kind === 'ig-square' ? canAccess(plan, 'visual_kit') : canAccess(plan, 'visual_kit_full')
}
export const kitWatermarked = (plan: PlanTier) => !canAccess(plan, 'visual_kit_full')
export const kitPdfAllowed = (plan: PlanTier) => canAccess(plan, 'visual_kit_pdf')
