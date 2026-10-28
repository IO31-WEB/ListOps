/**
 * Brand-kit images (logos, headshot) — the ONE place that decides how a stored brand image is addressed.
 *
 * Like listing photos (lib/photos.ts), the stored value is resolved to a same-origin URL at read time:
 *
 *     /api/brand-assets/brand-kits/<userId>/<slot>-<version>.<ext>
 *
 * served by app/api/brand-assets/[...key]/route.ts, which reads R2 with our credentials. Previews, flyers,
 * microsites and graphics therefore no longer depend on the bucket being public, on NEXT_PUBLIC_R2_PUBLIC_URL
 * being right at build time, or on CORS / hotlink settings. This module is pure (no server imports) so client
 * components can use it too.
 */

export type BrandSlot = 'logo' | 'agentPhoto' | 'brokerageLogo'

/** Shape of every key our upload route generates. `-<version>` is a random suffix (older uploads had none). */
const KEY_RE = /^brand-kits\/[A-Za-z0-9_-]+\/(?:logo|agentPhoto|brokerageLogo)(?:-[A-Za-z0-9]{6,32})?\.(?:jpg|png|webp)$/
const KEY_IN_URL_RE = /(brand-kits\/[A-Za-z0-9_-]+\/(?:logo|agentPhoto|brokerageLogo)(?:-[A-Za-z0-9]{6,32})?\.(?:jpg|png|webp))(?:[?#].*)?$/

export function isBrandAssetKey(k: string): boolean {
  return KEY_RE.test(k)
}

/** True for keys with a random version suffix — their content never changes, so they can be cached forever. */
export function isVersionedBrandKey(k: string): boolean {
  return /-[A-Za-z0-9]{6,32}\.(?:jpg|png|webp)$/.test(k)
}

export function brandAssetUrl(key: string): string {
  return `/api/brand-assets/${key}`
}

/** The R2 key inside any stored brand image URL (absolute R2/public-domain URL, relative path, or bare key). */
export function brandAssetKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = KEY_IN_URL_RE.exec(url)
  return m ? m[1] : null
}

/**
 * Display URL for a stored brand image. Our own keys (however they were stored) become same-origin paths;
 * data: URLs (local-dev fallback) and unrelated https URLs pass through; anything else is dropped.
 */
export function resolveBrandAssetUrl(url: string | null | undefined): string {
  if (!url) return ''
  const key = brandAssetKeyFromUrl(url)
  if (key) return brandAssetUrl(key)
  if (/^data:image\/(?:png|jpeg|webp);base64,/.test(url) || /^https:\/\//.test(url)) return url
  return ''
}

const IMAGE_FIELDS = ['logoUrl', 'agentPhotoUrl', 'brokerageLogo'] as const

/** Copy of a brand-kit-shaped object with every image field resolved for display. */
export function withResolvedBrandAssets<T extends Record<string, any>>(bk: T): T {
  const out: Record<string, any> = { ...bk }
  for (const f of IMAGE_FIELDS) if (f in out) out[f] = resolveBrandAssetUrl(out[f]) || (out[f] ? '' : out[f])
  return out as T
}
