import { describe, test, expect, vi } from 'vitest'

// ai-budget writes a spend ledger to the DB; tests only exercise its pure cost math.
vi.mock('@/lib/db', () => ({ db: { insert: () => ({ values: () => Promise.resolve() }) } }))
import { sniffImage } from '@/lib/image-validate'
import { ListingInputSchema, assertOwnPhotoKeys, cleanText } from '@/lib/listing-schemas'
import { estimateCostUsd } from '@/lib/ai-budget'
import { rateLimitContact } from '@/lib/ratelimit'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

describe('image magic-byte validation', () => {
  test('accepts jpeg/png/webp', () => {
    expect(sniffImage(jpeg)?.ext).toBe('jpg')
    expect(sniffImage(png)?.ext).toBe('png')
    expect(sniffImage(webp)?.ext).toBe('webp')
  })
  test('rejects svg, html and tiny files regardless of claimed type', () => {
    expect(sniffImage(svg)).toBeNull()
    expect(sniffImage(new TextEncoder().encode('<html>not an image</html>'))).toBeNull()
    expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})

describe('listing input validation', () => {
  const base = { address: '905 Woodside Creek Ln', city: 'Summerville', state: 'sc' }
  test('normalizes state and applies defaults', () => {
    const r = ListingInputSchema.parse(base)
    expect(r.state).toBe('SC')
    expect(r.features).toEqual([])
    expect(r.source).toBe('manual')
  })
  test('strips angle brackets and control chars from single-line fields', () => {
    const r = ListingInputSchema.parse({ ...base, address: '1 <script>x</script> Main\u0000 St' })
    expect(r.address).not.toMatch(/[<>\u0000]/)
  })
  test('rejects out-of-range and malformed values', () => {
    expect(() => ListingInputSchema.parse({ ...base, state: 'ZZ' })).toThrow()
    expect(() => ListingInputSchema.parse({ ...base, price: -5 })).toThrow()
    expect(() => ListingInputSchema.parse({ ...base, bathrooms: 2.25 })).toThrow()
    expect(() => ListingInputSchema.parse({ ...base, yearBuilt: 1200 })).toThrow()
    expect(() => ListingInputSchema.parse({ ...base, zip: 'abc' })).toThrow()
    expect(() => ListingInputSchema.parse({ ...base, features: Array(40).fill('x') })).toThrow()
    expect(() => ListingInputSchema.parse({ ...base, description: 'x'.repeat(5000) })).toThrow()
  })
  test('cleanText removes control characters but keeps newlines', () => {
    expect(cleanText('a\u0000b\nc')).toBe('ab\nc')
  })
})

describe('photo key ownership', () => {
  const me = 'user_2abcDEF123'
  test('accepts keys under my own prefix', () => {
    expect(assertOwnPhotoKeys(me, [`listings/${me}/AbCdEfGhIjKlMnOp.jpg`])).toHaveLength(1)
  })
  test("rejects another user's keys, traversal and wrong extensions", () => {
    expect(() => assertOwnPhotoKeys(me, ['listings/user_other999/AbCdEfGhIjKlMnOp.jpg'])).toThrow()
    expect(() => assertOwnPhotoKeys(me, [`listings/${me}/../user_other999/AbCdEfGhIjKlMnOp.jpg`])).toThrow()
    expect(() => assertOwnPhotoKeys(me, [`listings/${me}/AbCdEfGhIjKlMnOp.svg`])).toThrow()
    expect(() => assertOwnPhotoKeys(me, ['https://evil.example/x.jpg'])).toThrow()
  })
})

describe('ai budget', () => {
  test('cost estimate scales with tokens and is conservative', () => {
    expect(estimateCostUsd(0, 0)).toBe(0)
    expect(estimateCostUsd(1_000_000, 0)).toBeGreaterThan(0)
    expect(estimateCostUsd(0, 1_000_000)).toBeGreaterThan(estimateCostUsd(1_000_000, 0))
  })
})

describe('rate limiter fails CLOSED without Redis', () => {
  test('contact form is limited even when Upstash is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const ip = `test-${Math.random()}`
    const results = []
    for (let i = 0; i < 5; i++) results.push((await rateLimitContact(ip)).success)
    expect(results.slice(0, 3)).toEqual([true, true, true])
    expect(results.slice(3)).toEqual([false, false])
  })
})
