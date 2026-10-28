/**
 * Listing-photo URLs — the ONE place that decides how a stored photo is addressed.
 *
 * Photos are stored in R2 under a server-generated key (listings/<clerkId>/<id>.<ext>). Instead of baking an
 * absolute R2 URL into the database (which broke whenever the public domain/env var changed or the bucket was
 * not public), every consumer derives the URL from the KEY at read time:
 *
 *     /api/photos/<key>   — same-origin, served by app/api/photos/[...key]/route.ts (reads R2 with our
 *                           credentials, long-lived immutable cache). No CORS / CSP / hotlink / bucket-policy
 *                           dependency, and the microsite, dashboard, flyer and emails all use the same URL.
 */
import { isListingPhotoKey } from '@/lib/listing-schemas'

export function photoUrl(key: string): string {
  return `/api/photos/${key}`
}

/** Pull a valid photo key out of a legacy stored URL (any host) — null if it doesn't look like one of ours. */
export function photoKeyFromLegacyUrl(url: string): string | null {
  const m = /(listings\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:jpg|png|webp))(?:\?.*)?$/.exec(url)
  return m && isListingPhotoKey(m[1]) ? m[1] : null
}

/**
 * Photos for display, from a listing row. Prefers photoKeys; for old rows without keys it repairs legacy
 * absolute URLs by recovering the key, and otherwise keeps only http(s) URLs.
 */
export function resolveListingPhotos(row: { photoKeys?: string[] | null; photos?: string[] | null } | null | undefined): string[] {
  if (!row) return []
  const keys = (row.photoKeys ?? []).filter(isListingPhotoKey)
  if (keys.length) return keys.map(photoUrl)
  return (row.photos ?? [])
    .map(u => {
      const k = photoKeyFromLegacyUrl(u)
      return k ? photoUrl(k) : /^https?:\/\//.test(u) ? u : ''
    })
    .filter(Boolean)
}
