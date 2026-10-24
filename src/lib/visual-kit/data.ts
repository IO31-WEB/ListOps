/**
 * Gathers everything a visual-kit graphic needs from the campaign + listing + brand kit.
 * Images are read straight from R2 (our credentials) and inlined as data URIs, because the renderer
 * (satori) cannot fetch our private-by-default storage and does not support WebP (those are skipped).
 */
import { getFromR2 } from '@/lib/r2'
import { sniffImage } from '@/lib/image-validate'
import { isListingPhotoKey } from '@/lib/listing-schemas'
import { resolveScheme } from '@/lib/color-schemes'
import { formatListingAddress, formatStreet, formatCity, formatState } from '@/lib/address'
import { sanitizeForPrompt } from '@/lib/prompt-safety'

export interface KitOptions { scheme: string; date?: string; time?: string; oldPrice?: number; watermark: boolean }

export interface KitData {
  street: string; cityState: string; fullAddress: string
  price: string; oldPrice: string | null
  beds: number; baths: number; sqft: string; yearBuilt: number | null
  photo: string | null
  agentName: string; agentTitle: string; phone: string; email: string; website: string; brokerage: string; tagline: string
  logo: string | null; brokerageLogo: string | null; headshot: string | null
  primary: string; accent: string
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
  const key = url ? BRAND_KEY_RE.exec(url)?.[1] : null
  return key ? keyToDataUri(key) : null
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const clean = (s: unknown, max: number) => sanitizeForPrompt(s, max).replace(/\s+/g, ' ').trim()

export async function loadKitData(campaign: any, opts: KitOptions, includeBrand: boolean): Promise<KitData> {
  const l = campaign.listing ?? {}
  const bk = includeBrand ? campaign.brandKit ?? null : null
  const { primary, accent } = resolveScheme(opts.scheme, bk?.primaryColor, bk?.accentColor)

  // First usable (JPEG/PNG) photo among the first three.
  let photo: string | null = null
  const keys: string[] = ((l.photoKeys ?? []) as string[]).filter(isListingPhotoKey).slice(0, 3)
  for (const k of keys) { photo = await keyToDataUri(k); if (photo) break }

  const [logo, brokerageLogo, headshot] = await Promise.all([
    brandImage(bk?.logoUrl), brandImage(bk?.brokerageLogo), brandImage(bk?.agentPhotoUrl),
  ])

  const priceNum = l.price ? Number(l.price) : 0
  return {
    street: formatStreet(l.address), cityState: [formatCity(l.city), formatState(l.state)].filter(Boolean).join(', '),
    fullAddress: formatListingAddress(l),
    price: priceNum ? money(priceNum) : 'Contact for price',
    oldPrice: opts.oldPrice && opts.oldPrice > priceNum && priceNum > 0 ? money(opts.oldPrice) : null,
    beds: l.bedrooms ?? 0, baths: l.bathrooms ? Number(l.bathrooms) : 0,
    sqft: l.sqft ? Number(l.sqft).toLocaleString('en-US') : '', yearBuilt: l.yearBuilt ?? null,
    photo,
    agentName: clean(bk?.agentName, 60), agentTitle: clean(bk?.agentTitle || '', 40), phone: clean(bk?.agentPhone, 30),
    email: clean(bk?.agentEmail, 80), website: clean(bk?.agentWebsite, 80), brokerage: clean(bk?.brokerageName, 70), tagline: clean(bk?.tagline, 90),
    logo, brokerageLogo, headshot,
    primary, accent,
    disclaimer: clean(bk?.disclaimer, 200),
    date: clean(opts.date, 40), time: clean(opts.time, 40),
    watermark: opts.watermark,
  }
}
