/** Color schemes shared by the HTML flyers and the PNG visual kit. 'brand' = the agent's own brand-kit colors. */
export const COLOR_SCHEMES = [
  { id: 'brand', label: 'Brand', desc: 'Your brand colors', primary: '', accent: '' },
  { id: 'navy', label: 'Navy', desc: 'Navy & gold', primary: '#1a2744', accent: '#c9a84c' },
  { id: 'charcoal', label: 'Charcoal', desc: 'Charcoal & amber', primary: '#2d2d2d', accent: '#e8a020' },
  { id: 'forest', label: 'Forest', desc: 'Forest green & cream', primary: '#1e4d2b', accent: '#f5f0e8' },
  { id: 'burgundy', label: 'Burgundy', desc: 'Burgundy & champagne', primary: '#6b1a2a', accent: '#d4b896' },
] as const

export type SchemeId = (typeof COLOR_SCHEMES)[number]['id']
export const SCHEME_IDS = COLOR_SCHEMES.map(s => s.id) as [SchemeId, ...SchemeId[]]

const HEX = /^#[0-9a-fA-F]{6}$/

export function resolveScheme(id: string | undefined, brandPrimary?: string | null, brandAccent?: string | null) {
  const s = COLOR_SCHEMES.find(x => x.id === id) ?? COLOR_SCHEMES[0]
  const bp = brandPrimary && HEX.test(brandPrimary) ? brandPrimary : '#1e3a5f'
  const ba = brandAccent && HEX.test(brandAccent) ? brandAccent : '#c9a84c'
  return { primary: s.primary || bp, accent: s.accent || ba }
}

/** Relative luminance 0..1 — used to pick readable text on a brand color. */
export function luminance(hex: string): number {
  if (!HEX.test(hex)) return 0
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const readableOn = (bg: string) => (luminance(bg) > 0.45 ? '#0f172a' : '#ffffff')
