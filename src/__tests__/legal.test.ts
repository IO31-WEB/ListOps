import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { query: { emailSuppressions: { findFirst: vi.fn() } } } }))

import { buildFooter, sendEmail } from '@/lib/email'
import { signEmail, verifyEmailToken, decodeEmailParam, unsubscribePageUrl, unsubscribeApiUrl } from '@/lib/unsubscribe'
import { assertAdult } from '@/lib/age'
import { renewalSummary } from '@/components/billing/renewal-notice'
import { ApiError } from '@/lib/api-utils'

const ADDR = 'ListOps LLC, 100 Main St, Austin, TX 78701'

describe('email footer (CAN-SPAM)', () => {
  test('marketing footer has unsubscribe link AND postal address, in text and html', () => {
    const f = buildFooter({ kind: 'marketing', address: ADDR, unsubscribeUrl: 'https://listops.io/unsubscribe?e=x&t=y' })
    expect(f.text).toContain('https://listops.io/unsubscribe?e=x&t=y')
    expect(f.text).toContain(ADDR)
    expect(f.html).toContain('href="https://listops.io/unsubscribe?e=x&amp;t=y"')
    expect(f.html).toContain(ADDR)
  })
  test('transactional footer has the address but no unsubscribe link', () => {
    const f = buildFooter({ kind: 'transactional', address: ADDR })
    expect(f.text).toContain(ADDR)
    expect(f.text.toLowerCase()).not.toContain('unsubscribe')
  })
  test('footer HTML-escapes user-influenced text', () => {
    const f = buildFooter({ kind: 'transactional', address: ADDR, reason: '<script>alert(1)</script>' })
    expect(f.html).not.toContain('<script>')
  })
})

describe('sendEmail refuses non-compliant marketing mail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_dummy'
    process.env.UNSUBSCRIBE_SECRET = 'x'.repeat(32)
  })
  test('no postal address configured -> refused, nothing sent', async () => {
    delete process.env.MAIL_FOOTER_ADDRESS
    const r = await sendEmail({ kind: 'marketing', to: 'a@b.com', subject: 's', text: 't' })
    expect(r).toEqual({ ok: false, reason: 'no_postal_address' })
  })
})

describe('unsubscribe tokens', () => {
  beforeEach(() => { process.env.UNSUBSCRIBE_SECRET = 'a-long-random-secret-value-1234567890'; process.env.NEXT_PUBLIC_APP_URL = 'https://listops.io' })
  test('valid token verifies, case-insensitively', () => {
    const t = signEmail('Jane@Example.com')
    expect(verifyEmailToken('jane@example.com', t)).toBe(true)
  })
  test('forged / wrong-address / garbage tokens fail', () => {
    const t = signEmail('jane@example.com')
    expect(verifyEmailToken('victim@example.com', t)).toBe(false)
    expect(verifyEmailToken('jane@example.com', t.slice(0, -2) + 'xx')).toBe(false)
    expect(verifyEmailToken('jane@example.com', '')).toBe(false)
  })
  test('refuses to work without a secret (fail closed)', () => {
    delete process.env.UNSUBSCRIBE_SECRET
    expect(() => signEmail('a@b.com')).toThrow()
    expect(verifyEmailToken('a@b.com', 'anything')).toBe(false)
  })
  test('links round-trip and use our domain', () => {
    const page = new URL(unsubscribePageUrl('Jane@Example.com'))
    expect(page.origin).toBe('https://listops.io')
    expect(decodeEmailParam(page.searchParams.get('e')!)).toBe('jane@example.com')
    expect(verifyEmailToken('jane@example.com', page.searchParams.get('t')!)).toBe(true)
    expect(unsubscribeApiUrl('jane@example.com')).toContain('/api/unsubscribe?e=')
  })
  test('decodeEmailParam rejects non-emails', () => {
    expect(decodeEmailParam(Buffer.from('not-an-email').toString('base64url'))).toBeNull()
  })
})

describe('age gate enforcement', () => {
  test('confirmed adults pass', () => {
    expect(() => assertAdult({ ageConfirmedAt: new Date(), ageBlockedAt: null })).not.toThrow()
  })
  test('unconfirmed accounts are rejected with 403', () => {
    try { assertAdult({ ageConfirmedAt: null, ageBlockedAt: null }); throw new Error('should have thrown') }
    catch (e) { expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).status).toBe(403) }
  })
  test('blocked (under-18) accounts are rejected even if somehow confirmed', () => {
    expect(() => assertAdult({ ageConfirmedAt: new Date(), ageBlockedAt: new Date() })).toThrow(ApiError)
  })
})

describe('renewal disclosure', () => {
  test('states price, frequency, auto-renewal and how to cancel', () => {
    const t = renewalSummary({ planName: 'Pro', price: 79, interval: 'month' })
    expect(t).toContain('$79/month')
    expect(t).toMatch(/Renews automatically every month/)
    expect(t).toMatch(/Cancel anytime in Dashboard/)
  })
  test('annual + trial wording is explicit about the first charge', () => {
    const t = renewalSummary({ planName: 'Brokerage', price: 2499, interval: 'year', trialDays: 14 })
    expect(t).toContain('Free for 14 days, then $2,499/year')
    expect(t).toMatch(/charged automatically when the trial ends/)
  })
})
