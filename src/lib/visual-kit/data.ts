/**
 * Gathers everything a visual-kit graphic needs from the campaign + listing + brand kit.
 * Images are read straight from R2 (our credentials) and inlined as data URIs, because the renderer
 * (satori) cannot fetch our private-by-default storage and does not support WebP (those are skipped).
 */
import { getFromR2 } from '@/lib/r2'
import { sniffImage } from '@/lib/image-validate'
import { isListingPhotoKey } from '@/lib/listing-schemas'
import { resolvePalette } from '@/lib/color-schemes'
import { formatListingAddress, formatStreet, formatCity, formatState } from '@/lib/address'
import { readCommercial } from '@/lib/commercial/types'
import { sanitizeForPrompt } from '@/lib/prompt-safety'
import { loadEffectiveBrandKit } from '@/lib/compliance/load'
import { KIT_CATALOG, type KitKind } from './catalog'

export interface KitOptions { scheme: string; date?: string; time?: string; oldPrice?: number; watermark: boolean; /** Shifts which photos are used (0–9) so the agent can reshuffle. */ shift?: number }

export interface KitData {
  street: string; cityState: string; fullAddress: string
  price: string; oldPrice: string | null
  beds: number; baths: number; sqft: string; yearBuilt: number | null
  photo: string | null
  /** Additional distinct photos (after `photo`) for multi-photo graphics such as the collage. */
  morePhotos: string[]
  agentName: string; agentTitle: string; phone: string; email: string; website: string; brokerage: string; tagline: string
  logo: string | null; brokerageLogo: string | null; headshot: string | null
  primary: string; accent: string
  /** Decorative rule color: the agent's first extra brand color when they set one, otherwise the accent. */
  rule?: string
  disclaimer: string
  date: string; time: string
  watermark: boolean
}

const BRAND_KEY_RE = /(brand-kits\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.(?:jpg|png|webp))(?:\?.*)?$/

export function toDataUri(bytes: Uint8Array): string | null {
  const kind = sniffImage(bytes)
  if (!kind || kind.ext === 'webp') return null // satori: JPEG/PNG only
  return `data:${kind.mime};base64,${Buffer.from(bytes).toString('base64')}`
}

async function keyToDataUri(key: string): Promise<string | null> {
  const obj = await getFromR2(key)
  return obj ? toDataUri(new Uint8Array(obj.body)) : null
}

async function brandImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  // Inline data URIs (dev fallback) pass straight through if they are JPEG/PNG.
  if (url.startsWith('data:image/png') || url.startsWith('data:image/jpeg')) return url
  const key = BRAND_KEY_RE.exec(url)?.[1]
  return key ? keyToDataUri(key) : null
}

/**
 * Picks `count` distinct renderable photos starting at `start` and wrapping around the listing's keys.
 * Photos that cannot be drawn (WebP, missing from storage) are skipped and the next one is tried.
 */
export async function pickPhotos(keys: string[], start: number, count: number): Promise<string[]> {
  const out: string[] = []
  if (!keys.length) return out
  for (let i = 0; i < keys.length && out.length < count; i++) {
    const uri = await keyToDataUri(keys[(start + i) % keys.length])
    if (uri) out.push(uri)
  }
  return out
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const clean = (s: unknown, max: number) => sanitizeForPrompt(s, max).replace(/\s+/g, ' ').trim()

export async function loadKitData(campaign: any, opts: KitOptions, includeBrand: boolean, kind: KitKind = 'ig-square'): Promise<KitData> {
  const l = campaign.listing ?? {}
  const bk = includeBrand ? await loadEffectiveBrandKit(campaign.brandKit ?? null, campaign.agentId) : null
  const { primary, accent, extras } = resolvePalette(opts.scheme, bk?.primaryColor, bk?.accentColor, (bk as any)?.extraColors)

  // Each graphic starts from its own photo slot (+ the agent's optional shuffle), so a set of graphics mixes the photos.
  const meta = KIT_CATALOG[kind]
  const keys: string[] = ((l.photoKeys ?? []) as string[]).filter(isListingPhotoKey).slice(0, 12)
  const picked = await pickPhotos(keys, meta.slot + (opts.shift ?? 0), meta.photos)
  const photo = picked[0] ?? null

  const [logo, brokerageLogo, headshot] = await Promise.all([
    brandImage(bk?.logoUrl), brandImage(bk?.brokerageLogo), brandImage(bk?.agentPhotoUrl),
  ])

  const priceNum = l.price ? Number(l.price) : 0
  const cre = readCommercial((l as any).commercial)
  return {
    street: formatStreet(l.address), cityState: [formatCity(l.city), formatState(l.state)].filter(Boolean).join(', '),
    fullAddress: formatListingAddress(l),
    price: cre?.priceGuidance ? clean(cre.priceGuidance, 40) : priceNum ? money(priceNum) : 'Contact for price',
    oldPrice: opts.oldPrice && opts.oldPrice > priceNum && priceNum > 0 ? money(opts.oldPrice) : null,
    beds: cre ? 0 : l.bedrooms ?? 0, baths: cre ? 0 : l.bathrooms ? Number(l.bathrooms) : 0,
    sqft: l.sqft ? Number(l.sqft).toLocaleString('en-US') : '', yearBuilt: l.yearBuilt ?? null,
    photo, morePhotos: picked.slice(1),
    agentName: clean(bk?.agentName, 60), agentTitle: clean(bk?.agentTitle || '', 40), phone: clean(bk?.agentPhone, 30),
    email: clean(bk?.agentEmail, 80), website: clean(bk?.agentWebsite, 80), brokerage: clean(bk?.brokerageName, 70), tagline: clean(bk?.tagline, 90),
    logo, brokerageLogo, headshot,
    primary, accent, rule: extras[0] ?? accent,
    disclaimer: clean(bk?.disclaimer, 240),
    date: clean(opts.date, 40), time: clean(opts.time, 40),
    watermark: opts.watermark,
  }
}
