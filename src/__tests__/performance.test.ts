import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TOKEN_RE, campaignAgeDays, dayKey, fillDaily, groupSources, isBotUserAgent, rate, sum } from '@/lib/performance/stats'
import { canAccess } from '@/lib/plans'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('performance stats', () => {
  test('dayKey uses the app timezone, not UTC', () => {
    // 2026-11-02 03:30 UTC is still Nov 1 in New York (EST, UTC-5)
    expect(dayKey(new Date('2026-11-02T03:30:00Z'))).toBe('2026-11-01')
    expect(dayKey(new Date('2026-07-01T12:00:00Z'))).toBe('2026-07-01')
  })
  test('fillDaily zero-fills, orders oldest→newest, ends today, spans month boundaries', () => {
    const pts = fillDaily([{ day: '2026-10-30', count: 4 }, { day: '2026-11-02', count: 2 }, { day: '2026-11-02', count: 1 }], 5, '2026-11-02')
    expect(pts.map(p => p.day)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(pts.map(p => p.count)).toEqual([0, 4, 0, 0, 3])
    expect(sum(pts)).toBe(7)
  })
  test('bots, previews and missing UAs are not buyers', () => {
    for (const ua of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'Slackbot-LinkExpanding', 'curl/8.0', 'HeadlessChrome', 'WhatsApp/2', '', null, undefined]) expect(isBotUserAgent(ua as any), String(ua)).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe(false)
  })
  test('groupSources', () => {
    expect(groupSources([{ source: 'instagram' }, { source: null }, { source: ' ' }, { source: 'instagram' }, { source: 'facebook' }]))
      .toEqual([{ source: 'direct', count: 2 }, { source: 'instagram', count: 2 }, { source: 'facebook', count: 1 }])
  })
  test('rate never invents a number', () => {
    expect(rate(1, 0)).toBeNull(); expect(rate(1, 8)).toBe(12.5); expect(rate(0, 5)).toBe(0)
  })
  test('campaignAgeDays and token shape', () => {
    expect(campaignAgeDays(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-11T12:00:00Z'))).toBe(10)
    expect(campaignAgeDays(new Date('2026-10-12T00:00:00Z'), new Date('2026-10-11T00:00:00Z'))).toBe(0)
    expect(TOKEN_RE.test('A'.repeat(32))).toBe(true); expect(TOKEN_RE.test('short')).toBe(false); expect(TOKEN_RE.test('../'.repeat(11))).toBe(false)
  })
})

describe('wiring', () => {
  test('gates', () => {
    expect(canAccess('free', 'performance_dashboard')).toBe(false)
    expect(canAccess('starter', 'performance_dashboard')).toBe(true)
    expect(canAccess('starter', 'seller_report')).toBe(false)
    expect(canAccess('pro', 'seller_report')).toBe(true)
  })
  test('microsite counts atomically, skips bots and the owner, tracks clicks', () => {
    const s = read('src/app/l/[slug]/page.tsx')
    for (const n of ['isBotUserAgent(', 'isOwner', '${campaigns.micrositeViews} + 1', "recordEvent(campaign.id, 'view')", 'TrackedLink']) expect(s).toContain(n)
  })
  test('recorder is an atomic upsert and never throws', () => {
    const s = read('src/lib/performance/record.ts')
    expect(s).toContain('onConflictDoUpdate'); expect(s).toContain('${campaignEvents.count} + 1'); expect(s).toContain('catch')
  })
  test('public event route accepts only the two click kinds and filters bots', () => {
    const s = read('src/app/api/l/[slug]/event/route.ts')
    expect(s).toContain('PUBLIC_EVENT_KINDS'); expect(s).toContain('isBotUserAgent('); expect(s).toContain('rateLimitLeadIp(')
    expect(read('src/lib/performance/stats.ts')).toContain("PUBLIC_EVENT_KINDS = ['click_call', 'click_email']")
  })
  test('downloads are counted by the routes that serve them', () => {
    expect(read('src/app/api/campaigns/[id]/pdf/route.ts')).toContain("recordEvent(id, 'flyer_pdf')")
    expect(read('src/app/api/campaigns/[id]/visual-kit/route.ts')).toContain("recordEvent(campaign.id, 'kit_download')")
  })
  test('seller report API: owner-scoped, plan-gated, same-origin writes, rotates links', () => {
    const s = read('src/app/api/campaigns/[id]/seller-report/route.ts')
    for (const n of ['requireUserId()', 'getCampaign(', "'seller_report'", 'assertSameOrigin(', 'revokedAt: new Date()', "randomBytes(24).toString('base64url')"]) expect(s).toContain(n)
  })
  test('public report page: token-validated, not indexed, no lead PII, still plan-gated, revocable', () => {
    const s = read('src/app/r/[token]/page.tsx')
    expect(s).toContain('TOKEN_RE.test(token)'); expect(s).toContain('index: false'); expect(s).toContain('isNull(sellerReports.revokedAt)'); expect(s).toContain("canAccess(plan, 'seller_report')")
    // No lead PII: the page never touches lead rows (names / emails / phones). `perf.clicks.email` is a COUNT of
    // email-button taps, so it is not matched here (the old '.email}' substring check flagged it by mistake).
    for (const pii of ['l.email', 'leads.email', 'leads.name', 'leads.phone', 'lead.email', 'lead.name', 'lead.phone']) expect(s).not.toContain(pii)
    expect(s).not.toMatch(/import[^\n]*\bleads\b[^\n]*from '@\/lib\/db\/schema'/)
    expect(read('src/middleware.ts')).toContain("'/r/(.*)'")
  })
  test('privacy policy mentions the counters', () => {
    expect(read('src/app/privacy/page.tsx')).toContain('daily counters of page views')
  })
})
