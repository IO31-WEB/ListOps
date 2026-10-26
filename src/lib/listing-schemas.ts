/**
 * Server-side validation + sanitization for listing input.
 * Everything from the client is untrusted: types, ranges, lengths and characters are
 * enforced here, regardless of what the form does.
 */

import { z } from 'zod'
import { titleCaseAddress } from '@/lib/address'
import { CommercialDetailsSchema } from '@/lib/commercial/types'

/** Strip control chars (keep \n and \t), normalize whitespace, trim. */
export function cleanText(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Single-line fields (address, city...) additionally lose angle brackets. */
const line = (min: number, max: number) =>
  z.string().transform(s => cleanText(s).replace(/[<>]/g, '').replace(/\s+/g, ' ')).pipe(z.string().min(min).max(max))

/** Same as `line`, plus title-case normalization — applied server-side regardless of what the client sent. */
const addrLine = (min: number, max: number) =>
  z.string().transform(s => titleCaseAddress(cleanText(s).replace(/[<>]/g, ''))).pipe(z.string().min(min).max(max))

const optLine = (max: number) =>
  z.string().transform(s => cleanText(s).replace(/[<>]/g, '').replace(/\s+/g, ' ')).pipe(z.string().max(max)).optional()

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO',
  'MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const

export const PROPERTY_TYPES = [
  'Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Land', 'Mobile/Manufactured', 'Other',
] as const

const currentYear = new Date().getFullYear()

export const ListingInputSchema = z.object({
  address: addrLine(3, 120),
  city: addrLine(1, 80),
  state: z.string().transform(s => s.trim().toUpperCase()).pipe(z.enum(US_STATES)),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional().or(z.literal('').transform(() => undefined)),
  price: z.number().int().min(0).max(5_000_000_000).nullable().optional(),
  bedrooms: z.number().int().min(0).max(50).nullable().optional(),
  bathrooms: z.number().min(0).max(50).multipleOf(0.5).nullable().optional(),
  sqft: z.number().int().min(0).max(50_000_000).nullable().optional(),
  yearBuilt: z.number().int().min(1600).max(currentYear + 2).nullable().optional(),
  propertyType: z.enum([...PROPERTY_TYPES, 'Retail', 'Office', 'Industrial', 'Multifamily', 'Mixed-use', 'Land (commercial)']).optional(),
  features: z.array(line(1, 60)).max(25).default([]),
  description: z.string().transform(cleanText).pipe(z.string().max(4000)).optional(),
  /** R2 object keys returned by /api/uploads/listing-photo. Ownership is verified in the route. */
  photoKeys: z.array(z.string().max(200)).max(20).default([]),
  /** v13: present only for commercial listings. Residential rows keep this undefined/null. */
  commercial: CommercialDetailsSchema.optional(),
  /** Where the structured data came from. */
  source: z.enum(['manual', 'enriched']).default('manual'),
  enrichmentProvider: optLine(40),
})

export type ListingInput = z.infer<typeof ListingInputSchema>

export const EnrichRequestSchema = z.object({
  address: line(3, 120),
  city: optLine(80),
  state: z.string().transform(s => s.trim().toUpperCase()).pipe(z.enum(US_STATES)),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional().or(z.literal('').transform(() => undefined)),
})

export const UuidSchema = z.string().uuid()

/** Photo keys are generated server-side as listings/<clerkUserId>/<nanoid>.<ext>. */
export function photoKeyPrefix(userId: string) {
  return `listings/${userId}/`
}
export const KEY_RE = /^listings\/[A-Za-z0-9_-]{5,64}\/[A-Za-z0-9_-]{10,40}\.(jpg|png|webp)$/

/** True only for keys our upload route could have generated (used by the public photo route). */
export function isListingPhotoKey(k: string): boolean {
  return KEY_RE.test(k)
}

export function assertOwnPhotoKeys(userId: string, keys: string[]): string[] {
  const prefix = photoKeyPrefix(userId)
  for (const k of keys) {
    if (!KEY_RE.test(k) || !k.startsWith(prefix)) throw new z.ZodError([{ code: 'custom', path: ['photoKeys'], message: 'invalid photo key' }])
  }
  return keys
}
