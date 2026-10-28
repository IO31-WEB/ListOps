import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn(), auth: vi.fn() }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') }, redirect: () => { throw new Error('NEXT_REDIRECT') } }))

import { currentUser } from '@clerk/nextjs/server'
import { ADMIN_EMAILS, getAdmin, assertSameOrigin, requireAdminPage } from '@/lib/admin'
import { cronAuthorized } from '@/lib/cron-auth'
import { r2KeyFromUrl, RETENTION } from '@/lib/retention'
import { csvCell } from '@/lib/team-data'
import { isUniqueViolation } from '@/lib/api-utils'
import { imageDimensions, dimensionsOk } from '@/lib/image-validate'

const mockUser = (email: string, status: string = 'verified') => ({
  id: 'user_abc', primaryEmailAddressId: 'e1',
  emailAddresses: [{ id: 'e1', emailAddress: email, verification: { status } }],
})

describe('admin access control', () => {
  beforeEach(() => vi.mocked(currentUser).mockReset())
  test('allow-list contains exactly the one configured admin', () => {
    expect(ADMIN_EMAILS).toEqual(['isaiaholiver95@yahoo.com'])
  })
  test('verified allow-listed email (any casing) is admin', async () => {
    vi.mocked(currentUser).mockResolvedValue(mockUser('IsaiahOliver95@Yahoo.com') as never)
    expect(await getAdmin()).toMatchObject({ email: 'isaiaholiver95@yahoo.com' })
  })
  test('UNVERIFIED allow-listed email is NOT admin (prevents claiming the address)', async () => {
    vi.mocked(currentUser).mockResolvedValue(mockUser('isaiaholiver95@yahoo.com', 'unverified') as never)
    expect(await getAdmin()).toBeNull()
  })
  test('any other user, or no session, is not admin', async () => {
    vi.mocked(currentUser).mockResolvedValue(mockUser('someone@else.com') as never)
    expect(await getAdmin()).toBeNull()
    vi.mocked(currentUser).mockResolvedValue(null as never)
    expect(await getAdmin()).toBeNull()
  })
  test('lookalike addresses do not match', async () => {
    for (const e of ['isaiaholiver95@yahoo.com.evil.io', 'xisaiaholiver95@yahoo.com', 'isaiaholiver95+x@yahoo.com']) {
      vi.mocked(currentUser).mockResolvedValue(mockUser(e) as never)
      expect(await getAdmin()).toBeNull()
    }
  })
  test('admin pages render 404 for non-admins', async () => {
    vi.mocked(currentUser).mockResolvedValue(mockUser('someone@else.com') as never)
    await expect(requireAdminPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
  test('same-origin check blocks cross-site and missing Origin', () => {
    const req = (h: Record<string, string>) => new Request('https://listops.io/api/admin/x', { method: 'POST', headers: h })
    expect(() => assertSameOrigin(req({ origin: 'https://listops.io', host: 'listops.io' }))).not.toThrow()
    expect(() => assertSameOrigin(req({ origin: 'https://evil.com', host: 'listops.io' }))).toThrow()
    expect(() => assertSameOrigin(req({ host: 'listops.io' }))).toThrow()
  })
})

describe('cron auth fails closed', () => {
  const r = (auth?: string) => new Request('https://x/api/cron/daily', { headers: auth ? { authorization: auth } : {} })
  test('rejects when secret unset/short, wrong or missing header', () => {
    delete process.env.CRON_SECRET
    expect(cronAuthorized(r('Bearer anything'))).toBe(false)
    process.env.CRON_SECRET = 'short'
    expect(cronAuthorized(r('Bearer short'))).toBe(false)
    process.env.CRON_SECRET = 'a-long-enough-secret-123456'
    expect(cronAuthorized(r())).toBe(false)
    expect(cronAuthorized(r('Bearer wrong-secret-of-same-len-123'))).toBe(false)
  })
  test('accepts the exact bearer token', () => {
    process.env.CRON_SECRET = 'a-long-enough-secret-123456'
    expect(cronAuthorized(r('Bearer a-long-enough-secret-123456'))).toBe(true)
  })
})

describe('retention helpers', () => {
  test('r2KeyFromUrl maps only OUR bucket URLs back to keys', () => {
    const base = 'https://assets.listops.io'
    expect(r2KeyFromUrl('https://assets.listops.io/brand-kits/u1/logo.png?v=3', base)).toBe('brand-kits/u1/logo.png')
    expect(r2KeyFromUrl('https://evil.com/brand-kits/u1/logo.png', base)).toBeNull()
    expect(r2KeyFromUrl('https://assets.listops.io/../secret', base)).toBeNull()
    expect(r2KeyFromUrl(null, base)).toBeNull()
  })
  test('policy constants are sane', () => {
    expect(RETENTION.closedAccountDays).toBe(30)
    expect(RETENTION.auditLogDays).toBeGreaterThanOrEqual(365)
  })
})

describe('CSV export safety', () => {
  test('escapes quotes/commas/newlines', () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"')
  })
  test('neutralizes spreadsheet formula injection', () => {
    // the cell may be wrapped in CSV quotes; either way its CONTENT must start with a neutralizing apostrophe
    for (const evil of ['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUM(A1)']) expect(csvCell(evil).replace(/^"/, '').startsWith("'")).toBe(true)
  })
})

describe('db unique-violation detection (double-submit guard)', () => {
  test('recognizes code 23505 directly and via cause', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
    expect(isUniqueViolation({ message: 'wrapped', cause: { code: '23505' } })).toBe(true)
    expect(isUniqueViolation(new Error('duplicate key value violates unique constraint "x"'))).toBe(true)
    expect(isUniqueViolation(new Error('timeout'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

describe('image dimension validation', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b
  }
  test('reads PNG dimensions and enforces limits', () => {
    expect(imageDimensions(png(1600, 1200))).toEqual({ width: 1600, height: 1200 })
    expect(dimensionsOk(png(1600, 1200))).toBe(true)
    expect(dimensionsOk(png(9000, 100))).toBe(false)
    expect(dimensionsOk(png(7000, 7500))).toBe(false) // > 50 megapixels
    expect(dimensionsOk(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]))).toBe(false)
  })
  test('reads JPEG dimensions from the SOF marker', () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x04, 0xb0, 0x06, 0x40, 3, 0, 0])
    expect(imageDimensions(jpg)).toEqual({ width: 1600, height: 1200 })
  })
})
