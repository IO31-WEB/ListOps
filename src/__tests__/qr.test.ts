import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { MAX_VERSION, byteCapacity, encodeQr, qrPath, qrSvg } from '@/lib/qr/encode'
import { CODE_RE, micrositeLanding, newQrCode, QR_PLACEMENTS } from '@/lib/qr/codes'
import { canAccess } from '@/lib/plans'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('qr encoder', () => {
  test('picks the smallest version that fits (level M, byte mode)', () => {
    expect(encodeQr('https://listops.io/q/k7m2p9xq').version).toBe(3)
    expect(encodeQr('A').version).toBe(1)
    expect(encodeQr('x'.repeat(byteCapacity(1))).version).toBe(1)
    expect(encodeQr('x'.repeat(byteCapacity(1) + 1)).version).toBe(2)
    expect(encodeQr('x'.repeat(byteCapacity(MAX_VERSION))).version).toBe(MAX_VERSION)
  })
  test('too long input throws instead of producing a bad code', () => {
    expect(() => encodeQr('x'.repeat(byteCapacity(MAX_VERSION) + 1))).toThrow(RangeError)
  })
  test('finder patterns, timing and dark module are in place', () => {
    const { modules, size } = encodeQr('https://listops.io/q/k7m2p9xq')
    expect(size).toBe(29)
    for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) { expect(modules[y][x]).toBe(true); expect(modules[y + 3][x + 3]).toBe(true); expect(modules[y + 1][x + 1]).toBe(false) }
    for (let i = 8; i < size - 8; i++) expect(modules[6][i]).toBe(i % 2 === 0)
    expect(modules[size - 8][8]).toBe(true)
  })
  test('deterministic', () => expect(qrPath(encodeQr('hello'))).toBe(qrPath(encodeQr('hello'))))
  test('svg is well formed and only ever contains validated colours', () => {
    const svg = qrSvg('https://listops.io/q/abcdefgh', { dark: 'red;"onload="x', light: '#ffffff' })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).not.toContain('onload')
    expect(svg).toContain('fill="#000000"')
  })
})

describe('qr codes', () => {
  test('generated codes match the validator and are unlikely to repeat', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) { const c = newQrCode(); expect(CODE_RE.test(c)).toBe(true); seen.add(c) }
    expect(seen.size).toBe(500)
  })
  test('validator rejects look-alikes, wrong length and injection', () => {
    for (const bad of ['', 'abcdefg', 'abcdefghi', 'ABCDEFGH', 'abcdefg0', 'abcdefgl', '../etc/p', 'abc def1']) expect(CODE_RE.test(bad), bad).toBe(false)
  })
  test('landing URL is a fixed in-site path with encoded params (no open redirect)', () => {
    const u = micrositeLanding('my-slug', 'yard_sign')
    expect(u).toBe('/l/my-slug?utm_source=qr&utm_medium=print&utm_campaign=yard_sign')
    expect(micrositeLanding('//evil.com/x', 'flyer').startsWith('/l/')).toBe(true)
    expect(micrositeLanding('//evil.com/x', 'flyer')).not.toContain('//evil')
    expect(QR_PLACEMENTS).toContain('flyer')
  })
})

describe('qr wiring', () => {
  test('Starter+ only', () => {
    expect(canAccess('free', 'qr_codes')).toBe(false)
    expect(canAccess('starter', 'qr_codes')).toBe(true)
  })
  test('public redirect is whitelisted in middleware and filters bots / owner / floods', () => {
    expect(read('src/middleware.ts')).toContain("'/q/(.*)'")
    const r = read('src/app/q/[code]/route.ts')
    expect(r).toContain('isBotUserAgent')
    expect(r).toContain('rateLimitQr')
    expect(r).toContain('CODE_RE')
    expect(r).toMatch(/no-store/)
  })
  test('management routes are owner-scoped, plan-gated and same-origin', () => {
    expect(read('src/app/api/campaigns/[id]/qr/route.ts')).toMatch(/assertSameOrigin\([\s\S]*canAccess\(quota\.planTier, 'qr_codes'\)/)
    expect(read('src/app/api/qr/[code]/route.ts')).toContain('qr.agentId !== user.id')
  })
  test('flyer QR failure cannot break the flyer', () => expect(read('src/app/flyer/[id]/page.tsx')).toMatch(/try \{[\s\S]*getOrCreateQr[\s\S]*catch/))
})
