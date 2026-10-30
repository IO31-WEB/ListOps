/**
 * Color schemes shared by the HTML flyers, the tri-fold brochure and the PNG visual kit.
 * 'brand' = the agent's own brand-kit colors (primary + accent + any extra colors they added).
 *
 * Every preset keeps a DEEP primary (it is used as text on white and as the dark panel color) and puts the soft tone
 * in the accent — that is how the pastel / earth / beach families stay legible in print.
 */
export const SCHEME_GROUPS = ['Brand', 'Classic', 'Pastel', 'Earth', 'Beach'] as const
export type SchemeGroup = (typeof SCHEME_GROUPS)[number]

export const COLOR_SCHEMES = [
  { id: 'brand', group: 'Brand', label: 'Brand', desc: 'Your brand colors', primary: '', accent: '' },
  { id: 'navy', group: 'Classic', label: 'Navy', desc: 'Navy & gold', primary: '#1a2744', accent: '#c9a84c' },
  { id: 'charcoal', group: 'Classic', label: 'Charcoal', desc: 'Charcoal & amber', primary: '#2d2d2d', accent: '#e8a020' },
  { id: 'forest', group: 'Classic', label: 'Forest', desc: 'Forest green & cream', primary: '#1e4d2b', accent: '#f5f0e8' },
  { id: 'burgundy', group: 'Classic', label: 'Burgundy', desc: 'Burgundy & champagne', primary: '#6b1a2a', accent: '#d4b896' },
  // Pastels — soft accent on a deep, muted ground
  { id: 'pastel-blush', group: 'Pastel', label: 'Blush', desc: 'Plum & blush pink', primary: '#5b3a4a', accent: '#f4c6d0' },
  { id: 'pastel-sage', group: 'Pastel', label: 'Sage', desc: 'Deep green & soft sage', primary: '#3f5a4a', accent: '#c9ddc6' },
  { id: 'pastel-sky', group: 'Pastel', label: 'Sky', desc: 'Slate blue & powder blue', primary: '#3b5271', accent: '#c5d9f0' },
  // Earth tones
  { id: 'earth-terracotta', group: 'Earth', label: 'Terracotta', desc: 'Terracotta & sand', primary: '#7a3b27', accent: '#dba87a' },
  { id: 'earth-olive', group: 'Earth', label: 'Olive', desc: 'Olive & wheat', primary: '#4a4f2a', accent: '#d6c79a' },
  // Beach tones
  { id: 'beach-seafoam', group: 'Beach', label: 'Seafoam', desc: 'Deep teal & warm sand', primary: '#155e6b', accent: '#f1dcae' },
  { id: 'beach-coral', group: 'Beach', label: 'Coral Reef', desc: 'Ocean blue & coral', primary: '#0f4c63', accent: '#f6a98f' },
] as const

export type SchemeId = (typeof COLOR_SCHEMES)[number]['id']
export const SCHEME_IDS = COLOR_SCHEMES.map(s => s.id) as [SchemeId, ...SchemeId[]]

/** Schemes grouped for pickers (toolbar pills / <optgroup>), in SCHEME_GROUPS order. */
export function schemesByGroup() {
  return SCHEME_GROUPS.map(g => ({ group: g, schemes: COLOR_SCHEMES.filter(s => s.group === g) })).filter(g => g.schemes.length > 0)
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function resolveScheme(id: string | undefined, brandPrimary?: string | null, brandAccent?: string | null) {
  const s = COLOR_SCHEMES.find(x => x.id === id) ?? COLOR_SCHEMES[0]
  const bp = brandPrimary && HEX.test(brandPrimary) ? brandPrimary : '#1e3a5f'
  const ba = brandAccent && HEX.test(brandAccent) ? brandAccent : '#c9a84c'
  return { primary: s.primary || bp, accent: s.accent || ba }
}

/** Valid hex values from a brand kit's `extraColors` ([{ name, value }]), de-duplicated, max 6. Never throws. */
export function readExtraColors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const c of raw) {
    const v = typeof c === 'string' ? c : (c as { value?: unknown } | null)?.value
    if (typeof v === 'string' && HEX.test(v) && !out.includes(v.toLowerCase())) out.push(v.toLowerCase())
    if (out.length >= 6) break
  }
  return out
}

/**
 * resolveScheme + the agent's extra brand colors. Extras only apply to the 'brand' scheme (a preset scheme is a
 * deliberate, complete palette). Extras that equal the primary or accent are dropped so they always add something.
 * `palette` = [accent, ...extras] — decorative elements cycle through it (see paletteAt).
 */
export function resolvePalette(id: string | undefined, brandPrimary?: string | null, brandAccent?: string | null, brandExtras?: unknown) {
  const { primary, accent } = resolveScheme(id, brandPrimary, brandAccent)
  const isBrand = (COLOR_SCHEMES.find(x => x.id === id) ?? COLOR_SCHEMES[0]).id === 'brand'
  const extras = isBrand ? readExtraColors(brandExtras).filter(c => c !== primary.toLowerCase() && c !== accent.toLowerCase()) : []
  return { primary, accent, extras, palette: [accent, ...extras] }
}

/** i-th decorative color: accent first, then the extras, wrapping around. */
export function paletteAt(palette: string[], i: number): string {
  return palette.length ? palette[((i % palette.length) + palette.length) % palette.length] : '#000000'
}

/** Relative luminance 0..1 — used to pick readable text on a brand color. */
export function luminance(hex: string): number {
  if (!HEX.test(hex)) return 0
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const readableOn = (bg: string) => (luminance(bg) > 0.45 ? '#0f172a' : '#ffffff')

function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  const m = (i: number) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')
  return `#${m(1)}${m(3)}${m(5)}`
}

/** An accent safe to use as TEXT on a light background: pastel/sand accents are darkened until they read; others unchanged. */
export function accentInk(accent: string): string {
  if (!HEX.test(accent)) return accent
  return luminance(accent) > 0.3 ? mix(accent, '#1e293b', 0.62) : accent
}
