import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { titleCaseAddress, formatListingAddress, normalizeListing } from '@/lib/address'
import { photoUrl, resolveListingPhotos, photoKeyFromLegacyUrl } from '@/lib/photos'
import { comparePlan } from '@/lib/plans'
import { ListingInputSchema } from '@/lib/listing-schemas'

const KEY = 'listings/user_abc123/AbCdEfGhIjKlMnOp.jpg'
const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('address normalization', () => {
  test.each([
    ['136 sharp lane, elizabethton, tn', '136 Sharp Lane, Elizabethton, TN'],
    ['136 SHARP LANE', '136 Sharp Lane'],
    ['1200 n main st apt 4b', '1200 N Main St Apt 4B'],
    ['42nd ave ne', '42nd Ave NE'],
    ["o'brien rd", "O'Brien Rd"],
    ["mike's way", "Mike's Way"],
    ['po box 12', 'PO Box 12'],
  ])('%s -> %s', (i, o) => expect(titleCaseAddress(i)).toBe(o))

  test('idempotent', () => {
    const once = titleCaseAddress('136 sharp lane, elizabethton, tn')
    expect(titleCaseAddress(once)).toBe(once)
  })
  test('formatListingAddress keeps state upper-case', () =>
    expect(formatListingAddress({ address: '136 sharp lane', city: 'ELIZABETHTON', state: 'tn' })).toBe('136 Sharp Lane, Elizabethton, TN'))
  test('normalizeListing passes null through', () => expect(normalizeListing(null)).toBeNull())
  test('the save schema normalizes server-side regardless of client input', () => {
    const r = ListingInputSchema.parse({ address: '136 SHARP LANE', city: 'elizabethton', state: 'tn' })
    expect([r.address, r.city, r.state]).toEqual(['136 Sharp Lane', 'Elizabethton', 'TN'])
  })
})

describe('listing photo URLs', () => {
  test('derived from the storage key, same-origin', () => expect(photoUrl(KEY)).toBe(`/api/photos/${KEY}`))
  test('keys win over stale stored URLs', () =>
    expect(resolveListingPhotos({ photoKeys: [KEY], photos: ['https://dead.example.com/x.jpg'] })).toEqual([photoUrl(KEY)]))
  test('legacy absolute URLs are repaired to the proxy when the key is recoverable', () => {
    expect(photoKeyFromLegacyUrl(`https://old.r2.dev/${KEY}`)).toBe(KEY)
    expect(resolveListingPhotos({ photoKeys: [], photos: [`https://old.r2.dev/${KEY}`] })).toEqual([photoUrl(KEY)])
  })
  test('rejects traversal / foreign keys', () => {
    expect(resolveListingPhotos({ photoKeys: ['../../etc/passwd', 'brand/logo.png'], photos: [] })).toEqual([])
  })
})

describe('plan labels', () => {
  test('higher-priced plans are upgrades from every lower plan (incl. Commercial)', () => {
    expect(comparePlan('free', 'starter')).toBe('upgrade')
    expect(comparePlan('starter', 'pro')).toBe('upgrade')
    expect(comparePlan('pro', 'commercial')).toBe('upgrade')
    expect(comparePlan('pro', 'brokerage')).toBe('upgrade')
    expect(comparePlan('commercial', 'brokerage')).toBe('upgrade')
  })
  test('lower and same plans', () => {
    expect(comparePlan('brokerage', 'pro')).toBe('downgrade')
    expect(comparePlan('pro', 'free')).toBe('downgrade')
    expect(comparePlan('pro', 'pro')).toBe('current')
    expect(comparePlan('enterprise', 'brokerage')).toBe('downgrade')
  })
})

describe('microsite URL', () => {
  test('generated copy links to the real microsite slug, never /l/listing-<id>', () => {
    const gen = src('src/app/api/generate/route.ts')
    expect(gen).not.toMatch(/\/l\/listing-/)
    expect(gen).toMatch(/canonicalListingUrl\(listing\.micrositeSlug\)/)
    // the same slug that is stored on the campaign row
    expect(gen).toMatch(/status: 'generating', micrositeSlug,/)
  })
})
