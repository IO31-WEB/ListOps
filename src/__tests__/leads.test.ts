import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { botReason, cleanMessage, cleanTag, consentText, countUrls, normalizePhone, referrerHost } from '@/lib/leads/sanitize'
import { LeadInput } from '@/lib/leads/input'
import { csvCell, leadsToCsv } from '@/lib/leads/csv'
import { isPrivateIp, isPrivateIPv4, signPayload, validateWebhookUrl } from '@/lib/leads/webhook'
import { buildLeadEmail, buildLeadSms } from '@/lib/leads/message'
import { canAccess } from '@/lib/plans'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const valid = { kind: 'showing', name: ' Jane  Doe ', email: ' JANE@Example.com ', consent: true }

describe('lead input', () => {
  test('normalizes a valid submission', () => {
    const r = LeadInput.parse({ ...valid, phone: '(423) 555-0100', preferredDate: '2026-11-02', preferredTime: 'morning' })
    expect(r.name).toBe('Jane Doe')
    expect(r.email).toBe('jane@example.com')
    expect(r.phone).toBe('+14235550100')
  })
  test('consent is mandatory', () => {
    expect(() => LeadInput.parse({ ...valid, consent: false })).toThrow()
    expect(() => LeadInput.parse({ kind: 'info', name: 'A', email: 'a@b.co' })).toThrow()
  })
  test('rejects bad email, kind, date', () => {
    expect(() => LeadInput.parse({ ...valid, email: 'nope' })).toThrow()
    expect(() => LeadInput.parse({ ...valid, kind: 'other' })).toThrow()
    expect(() => LeadInput.parse({ ...valid, preferredDate: '2026-02-31' })).toThrow()
  })
  test('invalid phone becomes null instead of failing the lead', () => {
    expect(LeadInput.parse({ ...valid, phone: '12' }).phone).toBeNull()
  })
  test('source tags are sanitised and referrer reduced to host', () => {
    const r = LeadInput.parse({ ...valid, source: ' Instagram<script> ', referrer: 'https://l.facebook.com/l.php?u=secret' })
    expect(r.source).toBe('instagramscript')
    expect(r.referrer).toBe('l.facebook.com')
  })
})

describe('sanitize + spam', () => {
  test('phone formats', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
    expect(normalizePhone('1-423-555-0100')).toBe('+14235550100')
    expect(normalizePhone('abc')).toBeNull()
  })
  test('botReason', () => {
    expect(botReason({ website: 'http://spam' })).toBe('honeypot')
    expect(botReason({ elapsedMs: 300 })).toBe('too_fast')
    expect(botReason({ message: 'http://a.com http://b.com http://c.com' })).toBe('links')
    expect(botReason({ elapsedMs: 9000, message: 'Is the roof new? http://zillow.com' })).toBeNull()
    expect(countUrls('www.x.com and https://y.com')).toBe(2)
  })
  test('cleanMessage / cleanTag / referrerHost', () => {
    expect(cleanMessage('a\u0000b\r\n\n\n\nc')).toBe('ab\n\nc')
    expect(cleanTag('')).toBeNull()
    expect(referrerHost('not a url')).toBeNull()
  })
  test('consent text names the agent', () => {
    expect(consentText('Pat Lee')).toContain('Pat Lee')
    expect(consentText(null)).toContain('the listing agent')
  })
})

describe('csv', () => {
  test('neutralises formula injection and quotes specials', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1 555')).toBe("'+1 555")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell(null)).toBe('')
  })
  test('rows', () => {
    const d = new Date('2026-10-24T12:00:00Z')
    const out = leadsToCsv([{ createdAt: d, kind: 'info', status: 'new', name: '=cmd', email: 'a@b.co', phone: null, property: '1 Main St', preferredDate: null, preferredTime: null, message: 'hi\nthere', source: null, medium: null, campaignTag: null, referrerHost: null, consentAt: d }])
    const lines = out.trim().split('\r\n')
    expect(lines[0]).toContain('Consent given')
    expect(out).toContain("'=cmd")
    expect(out).toContain('direct')
  })
})

describe('webhook safety', () => {
  test('accepts public https', () => expect(validateWebhookUrl('https://hooks.zapier.com/hooks/catch/1/abc/').ok).toBe(true))
  test.each([
    'http://example.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.1/x',
    'https://169.254.169.254/latest', 'https://[::1]/x', 'https://user:pw@example.com/x', 'https://example.com:8443/x',
    'https://intranet/x', 'https://db.internal/x', 'not a url',
  ])('rejects %s', u => expect(validateWebhookUrl(u).ok).toBe(false))
  test('private ip detection incl. mapped v6', () => {
    expect(isPrivateIPv4('172.20.0.1')).toBe(true)
    expect(isPrivateIPv4('8.8.8.8')).toBe(false)
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true)
    expect(isPrivateIp('fd00::1')).toBe(true)
    expect(isPrivateIp('2606:4700::1111')).toBe(false)
  })
  test('signature is deterministic and secret-dependent', () => {
    expect(signPayload('s', '1', 'b')).toBe(signPayload('s', '1', 'b'))
    expect(signPayload('s', '1', 'b')).not.toBe(signPayload('t', '1', 'b'))
    expect(signPayload('s', '1', 'b')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('notification message', () => {
  const a = { kind: 'showing' as const, name: '<b>Eve</b>', email: 'e@x.co', phone: '+14235550100', message: '<script>x</script>', preferredDate: '2026-11-02', preferredTime: 'evening', address: '136 Sharp Lane, Elizabethton, TN', source: 'instagram', dashboardUrl: 'https://listops.io/dashboard/leads' }
  test('escapes HTML, includes details', () => {
    const m = buildLeadEmail(a)
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;b&gt;Eve')
    expect(m.text).toContain('Evening')
    expect(m.subject).toContain('136 Sharp Lane')
  })
  test('sms is short', () => expect(buildLeadSms(a).length).toBeLessThanOrEqual(300))
})

describe('plan gating + wiring', () => {
  test('gates', () => {
    expect(canAccess('free', 'lead_capture')).toBe(false)
    expect(canAccess('starter', 'lead_capture')).toBe(true)
    expect(canAccess('starter', 'lead_export')).toBe(false)
    expect(canAccess('pro', 'lead_webhook')).toBe(true)
    expect(canAccess('commercial', 'lead_sms')).toBe(true)
  })
  test('public route is whitelisted in middleware and enforces limits, consent and owner gate', () => {
    expect(read('src/middleware.ts')).toContain("'/api/l/(.*)'")
    const src = read('src/app/api/l/[slug]/lead/route.ts')
    for (const needle of ['rateLimitLeadIp', 'rateLimitLeadSlug', 'botReason', "canAccess(plan, 'lead_capture')", 'LeadInput.parse', 'micrositePublished']) expect(src).toContain(needle)
  })
  test('signed-in lead routes authenticate, are same-origin for writes, and gate by plan', () => {
    for (const p of ['src/app/api/leads/[id]/route.ts', 'src/app/api/leads/settings/route.ts', 'src/app/api/leads/settings/test/route.ts']) expect(read(p), p).toMatch(/requireUserId\(\)[\s\S]*assertSameOrigin\(/)
    expect(read('src/app/api/leads/export/route.ts')).toContain("'lead_export'")
    expect(read('src/app/api/leads/settings/test/route.ts')).toContain("'lead_webhook'")
  })
  test('microsite page shows the form only when the owner plan allows it', () => {
    const src = read('src/app/l/[slug]/page.tsx')
    expect(src).toContain("canAccess(ownerPlan, 'lead_capture')")
    expect(src).not.toContain('CAMPAIGNAI')
  })
})
