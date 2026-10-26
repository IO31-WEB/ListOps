import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { addDays, isIsoDate, isValidTimeZone, localParts, zonedToUtc } from '@/lib/social/time'
import { composeBody, derivedStatus, extractPosts, lengthIssue, planSchedule } from '@/lib/social/plan'
import { foldLine, postsToCsv, postsToIcs } from '@/lib/social/export'
import { canAccess } from '@/lib/plans'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('social time helpers', () => {
  test('zonedToUtc respects DST in both directions', () => {
    expect(zonedToUtc('2026-11-02', '10:00', 'America/New_York').toISOString()).toBe('2026-11-02T15:00:00.000Z') // EST
    expect(zonedToUtc('2026-07-01', '10:00', 'America/New_York').toISOString()).toBe('2026-07-01T14:00:00.000Z') // EDT
  })
  test('localParts round-trips', () => {
    expect(localParts(zonedToUtc('2026-11-02', '10:00', 'America/New_York'), 'America/New_York')).toEqual({ date: '2026-11-02', time: '10:00' })
  })
  test('date and tz validation', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('social planning', () => {
  const campaign = {
    facebookPosts: [{ week: 1, copy: 'Just listed!', hashtags: ['JustListed'] }, { week: 2, copy: 'Open house' }],
    instagramPosts: [{ week: 1, caption: 'Home sweet home #JustListed', hashtags: ['#JustListed', 'Tampa'] }],
    analytics: { linkedin: [{ week: 1, post: 'Market note' }] },
  }
  test('extractPosts composes hashtags without duplicating', () => {
    const posts = extractPosts(campaign)
    expect(posts).toHaveLength(4)
    expect(posts.find(p => p.sourceKey === 'instagramPosts:0')!.body).toBe('Home sweet home #JustListed\n\n#Tampa')
    expect(extractPosts(campaign, ['linkedin'])).toHaveLength(1)
  })
  test('empty copy is skipped; unknown shapes do not throw', () => {
    expect(extractPosts({ facebookPosts: [{ week: 1, copy: '  ' }] })).toEqual([])
    expect(extractPosts({})).toEqual([])
    expect(composeBody('x', 'not-an-array')).toBe('x')
  })
  test('planSchedule spreads channels across the week and weeks 7 days apart', () => {
    const planned = planSchedule('2026-11-02', 'America/New_York', extractPosts(campaign))
    const by = Object.fromEntries(planned.map(p => [p.sourceKey, localParts(p.scheduledFor, 'America/New_York')]))
    expect(by['facebookPosts:0']).toEqual({ date: '2026-11-02', time: '10:00' })
    expect(by['instagramPosts:0']).toEqual({ date: '2026-11-03', time: '12:00' })
    expect(by['linkedin:0']).toEqual({ date: '2026-11-04', time: '09:00' })
    expect(by['facebookPosts:1']).toEqual({ date: '2026-11-09', time: '10:00' })
  })
  test('source keys are unique (idempotent re-scheduling relies on this)', () => {
    const keys = extractPosts(campaign).map(p => p.sourceKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
  test('length limits', () => {
    expect(lengthIssue('instagram', 'a'.repeat(2201))).toMatch(/2,200/)
    expect(lengthIssue('instagram', Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' '))).toMatch(/30 hashtags/)
    expect(lengthIssue('facebook', 'hello')).toBeNull()
  })
  test('derived status is computed, never stored', () => {
    const now = new Date('2026-11-02T15:00:00Z')
    expect(derivedStatus('scheduled', new Date('2026-11-03T15:00:00Z'), now)).toBe('scheduled')
    expect(derivedStatus('scheduled', new Date('2026-11-02T14:00:00Z'), now)).toBe('due')
    expect(derivedStatus('scheduled', new Date('2026-10-30T14:00:00Z'), now)).toBe('overdue')
    expect(derivedStatus('posted', new Date('2020-01-01T00:00:00Z'), now)).toBe('posted')
  })
})

describe('social export', () => {
  const post = { id: 'abc', channel: 'facebook' as const, status: 'scheduled', body: 'Line one, with; punctuation\nLine two', scheduledFor: new Date('2026-11-02T15:00:00Z'), property: '1 Main St', imageUrl: null, link: null }
  test('csv neutralises spreadsheet formulas', () => {
    const csv = postsToCsv([{ ...post, body: '=HYPERLINK("http://evil")' }], 'America/New_York')
    expect(csv).not.toMatch(/,"?=HYPERLINK/)
    expect(csv).toContain('2026-11-02')
  })
  test('ics escapes text, folds long lines, and has a reminder', () => {
    const ics = postsToIcs([{ ...post, body: 'a'.repeat(300) + ', b; c' }], new Date('2026-11-01T00:00:00Z'))
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('DTSTART:20261102T150000Z')
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, '')).toContain('\\, b\\; c')
  })
  test('foldLine leaves short lines alone', () => expect(foldLine('SHORT')).toBe('SHORT'))
})

describe('social wiring', () => {
  test('Pro+ only', () => {
    expect(canAccess('free', 'social_scheduling')).toBe(false)
    expect(canAccess('starter', 'social_scheduling')).toBe(false)
    expect(canAccess('pro', 'social_scheduling')).toBe(true)
  })
  test('every social route is plan-gated through loadSocialContext and owner-scoped', () => {
    for (const f of ['src/app/api/social/posts/[id]/route.ts', 'src/app/api/social/export/route.ts', 'src/app/api/social/settings/route.ts', 'src/app/api/campaigns/[id]/social/schedule/route.ts'])
      expect(read(f), f).toContain('loadSocialContext(')
    expect(read('src/app/api/social/posts/[id]/route.ts')).toMatch(/agentId, user\.id/)
  })
  test('digest is wired into the daily cron and never double-sends', () => {
    expect(read('src/app/api/cron/daily/route.ts')).toContain('sendSocialDigests')
    const d = read('src/lib/social/digest.ts')
    expect(d).toContain('isNull(socialPosts.reminderSentAt)')
    expect(d).toContain('reminderSentAt: now')
  })
  test('account closure data is purged', () => {
    expect(read('src/app/api/cron/retention/route.ts')).toMatch(/delete\(socialPosts\)/)
  })
})
