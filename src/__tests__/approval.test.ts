import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildApprovalItems, summarize, validateSubmission } from '@/lib/approval/items'
import { canAccess } from '@/lib/plans'
import { TOKEN_RE } from '@/lib/performance/stats'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const campaign = {
  listing: { description: 'Fallback description' },
  emailJustListed: 'Hi there, a new home!',
  facebookPosts: [{ week: 1, copy: 'FB one', hashtags: ['JustListed'] }],
  instagramPosts: [{ week: 1, caption: 'IG one' }],
  analytics: { listingCopy: { headline: 'A Stunning Home', fullDescription: 'Long description' }, linkedin: [{ week: 2, post: 'LI two' }] },
}

describe('approval items', () => {
  test('builds a stable, labelled snapshot across groups', () => {
    const items = buildApprovalItems(campaign)
    expect(items.map(i => i.key)).toEqual(['headline', 'description', 'facebookPosts:0', 'instagramPosts:0', 'linkedin:0', 'email_just_listed'])
    expect(items.find(i => i.key === 'facebookPosts:0')!.text).toBe('FB one\n\n#JustListed')
    expect(items.find(i => i.key === 'linkedin:0')!.label).toBe('LinkedIn · week 2')
  })
  test('group filter and empty content', () => {
    expect(buildApprovalItems(campaign, ['email']).map(i => i.key)).toEqual(['email_just_listed'])
    expect(buildApprovalItems({})).toEqual([])
    expect(buildApprovalItems({ listing: { description: 'Only this' } }).map(i => i.key)).toEqual(['description'])
  })
  test('text is capped so a snapshot stays small', () => {
    const it = buildApprovalItems({ emailJustListed: 'x'.repeat(50_000) })[0]
    expect(it.text.length).toBe(6000)
  })
})

describe('approval status', () => {
  const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
  test('pending → in progress → approved / changes requested', () => {
    expect(summarize(items, []).status).toBe('pending')
    expect(summarize(items, [{ itemKey: 'a', decision: 'approved', comment: null }]).status).toBe('in_progress')
    expect(summarize(items, items.map(i => ({ itemKey: i.key, decision: 'approved' as const, comment: null }))).status).toBe('approved')
    const s = summarize(items, [{ itemKey: 'a', decision: 'approved', comment: null }, { itemKey: 'b', decision: 'changes', comment: 'no' }])
    expect(s).toMatchObject({ approved: 1, changes: 1, pending: 1, status: 'changes_requested' })
  })
  test('answers for items not in the snapshot are ignored; empty snapshot is pending', () => {
    expect(summarize(items, [{ itemKey: 'zzz', decision: 'approved', comment: null }]).status).toBe('pending')
    expect(summarize([], []).status).toBe('pending')
  })
})

describe('submission validation', () => {
  const items = [{ key: 'a' }, { key: 'b' }]
  test('accepts a complete answer set', () => expect(validateSubmission(items, [{ key: 'a', decision: 'approved' }, { key: 'b', decision: 'changes', comment: 'shorter' }])).toBeNull())
  test('rejects missing, unknown, duplicate and comment-less changes', () => {
    expect(validateSubmission(items, [{ key: 'a', decision: 'approved' }])).toMatch(/every item/)
    expect(validateSubmission(items, [{ key: 'a', decision: 'approved' }, { key: 'x', decision: 'approved' }])).toMatch(/no longer/)
    expect(validateSubmission(items, [{ key: 'a', decision: 'approved' }, { key: 'a', decision: 'approved' }])).toMatch(/Duplicate/)
    expect(validateSubmission(items, [{ key: 'a', decision: 'approved' }, { key: 'b', decision: 'changes', comment: '  ' }])).toMatch(/what to change/)
  })
})

describe('approval wiring', () => {
  test('Pro+ only', () => { expect(canAccess('starter', 'seller_approval')).toBe(false); expect(canAccess('pro', 'seller_approval')).toBe(true) })
  test('token format matches what the create route generates', () => expect(TOKEN_RE.test(Buffer.alloc(24, 7).toString('base64url'))).toBe(true))
  test('public pages and API are whitelisted in middleware', () => {
    const m = read('src/middleware.ts')
    expect(m).toContain("'/a/(.*)'"); expect(m).toContain("'/api/a/(.*)'")
  })
  test('public submit route: rate limited, token-checked, plan-gated, validated against the snapshot', () => {
    const r = read('src/app/api/a/[token]/respond/route.ts')
    for (const needle of ['TOKEN_RE.test', 'rateLimitApproval', "canAccess(await getPlanTierForUserId(req.agentId), 'seller_approval')", 'validateSubmission', 'isNull(approvalRequests.revokedAt)']) expect(r, needle).toContain(needle)
    expect(r).not.toMatch(/x-forwarded-for[\s\S]*approvalResponses\)\.values\([\s\S]*ip/)
  })
  test('agent route is owner-scoped, same-origin and plan-gated; new link revokes the old', () => {
    const r = read('src/app/api/campaigns/[id]/approval/route.ts')
    expect(r).toContain('assertSameOrigin'); expect(r).toContain("'seller_approval'"); expect(r).toContain('getCampaign(id, clerkId)')
    expect(r).toMatch(/revokedAt: new Date\(\)[\s\S]*insert\(approvalRequests\)/)
  })
  test('seller page is noindex and never leaks the agent id', () => {
    const p = read('src/app/a/[token]/page.tsx')
    expect(p).toContain('index: false'); expect(p).not.toContain('agentId:')
  })
})
