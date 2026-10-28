import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { SEAT_LIMITS, seatLimitFor, canAccess, PLANS, planFromPriceId } from '@/lib/plans'
import { resolvePlan, isCommercialLocked } from '@/lib/plan-resolve'
import {
  canInviteRole, generateInviteToken, hashInviteToken, isPlausibleToken, membersToDetach, seatState, emailsMatch, INVITE_TTL_DAYS, inviteExpiry,
} from '@/lib/team-invite-rules'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const org = (plan: string, status: string) => ({ plan, subscriptions: [{ plan, status }] })

describe('seat limits', () => {
  test('exact limits', () => {
    expect(SEAT_LIMITS).toMatchObject({ free: 1, starter: 1, pro: 2, commercial: 2, brokerage: 25 })
    expect(seatLimitFor('commercial')).toBe(2) // was 50
  })
  test('plan cards agree with SEAT_LIMITS', () => {
    for (const p of PLANS) expect(p.maxAgents, p.id).toBe(SEAT_LIMITS[p.id])
  })
  test('no hard-coded seat tables left in the app', () => {
    expect(read('src/app/dashboard/team/page.tsx')).not.toMatch(/commercial:\s*50/)
    expect(read('src/app/api/webhooks/stripe/route.ts')).not.toMatch(/agentLimits/)
  })
  test('seat state counts live invites', () => {
    expect(seatState('pro', 1, 0).full).toBe(false)
    expect(seatState('pro', 1, 1).full).toBe(true)
    expect(seatState('pro', 2, 0).full).toBe(true)
    expect(seatState('free', 1, 0).full).toBe(true)
    expect(seatState('brokerage', 20, 4).remaining).toBe(1)
  })
})

describe('plan inheritance', () => {
  test('member inherits only while the subscription is active or trialing', () => {
    expect(resolvePlan({ role: 'agent', organization: org('commercial', 'active') })).toBe('commercial')
    expect(resolvePlan({ role: 'agent', organization: org('pro', 'trialing') })).toBe('pro')
    for (const s of ['past_due', 'canceled', 'paused', 'weird']) expect(resolvePlan({ role: 'agent', organization: org('pro', s) }), s).toBe('free')
  })
  test('owner keeps access through past_due but not canceled', () => {
    expect(resolvePlan({ role: 'owner', organization: org('pro', 'past_due') })).toBe('pro')
    expect(resolvePlan({ role: 'owner', organization: org('pro', 'canceled') })).toBe('free')
  })
  test('members of a plan without team seats get nothing paid', () => {
    expect(resolvePlan({ role: 'agent', organization: org('starter', 'active') })).toBe('free')
  })
  test('missing org or unknown plan => free', () => {
    expect(resolvePlan(null)).toBe('free')
    expect(resolvePlan({ role: 'owner', organization: org('bogus', 'active') })).toBe('free')
  })
})

describe('commercial gating', () => {
  test('Free/Starter/Pro can never see commercial', () => {
    for (const p of ['free', 'starter', 'pro'] as const) {
      expect(canAccess(p, 'commercial_campaigns')).toBe(false)
      expect(isCommercialLocked('commercial', p)).toBe(true)
    }
    expect(isCommercialLocked('commercial', 'commercial')).toBe(false)
    expect(isCommercialLocked('residential', 'free')).toBe(false)
  })
  test('commercial price ids map to commercial', () => {
    process.env.STRIPE_COMMERCIAL_MONTHLY_PRICE_ID = 'price_c_m'
    expect(planFromPriceId('price_c_m')).toBe('commercial')
    expect(planFromPriceId('nope')).toBe('free')
    expect(planFromPriceId(undefined)).toBe('free')
  })
})

describe('invite rules', () => {
  test('tokens are 256-bit, url-safe, hashed', () => {
    const t = generateInviteToken()
    expect(isPlausibleToken(t)).toBe(true)
    expect(hashInviteToken(t)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashInviteToken(t)).not.toContain(t)
    expect(generateInviteToken()).not.toBe(t)
    expect(isPlausibleToken('short')).toBe(false)
    expect(isPlausibleToken("x'; drop table")).toBe(false)
  })
  test('roles: never owner; only owner mints admins', () => {
    expect(canInviteRole('owner', 'owner')).toBe(false)
    expect(canInviteRole('owner', 'admin')).toBe(true)
    expect(canInviteRole('admin', 'admin')).toBe(false)
    expect(canInviteRole('admin', 'agent')).toBe(true)
    expect(canInviteRole('agent', 'viewer')).toBe(false)
  })
  test('email match is case-insensitive and exact', () => {
    expect(emailsMatch('A@B.com', 'a@b.COM ')).toBe(true)
    expect(emailsMatch('a@b.com', 'c@b.com')).toBe(false)
    expect(emailsMatch(null, 'a@b.com')).toBe(false)
  })
  test('expiry is 7 days', () => {
    const now = new Date('2026-10-27T00:00:00Z')
    expect(inviteExpiry(now).getTime() - now.getTime()).toBe(INVITE_TTL_DAYS * 86_400_000)
  })
  test('downgrade keeps the owner then oldest members', () => {
    const m = [
      { id: 'c', role: 'agent', createdAt: '2026-03-01' }, { id: 'o', role: 'owner', createdAt: '2026-05-01' },
      { id: 'a', role: 'agent', createdAt: '2026-01-01' }, { id: 'b', role: 'admin', createdAt: '2026-02-01' },
    ]
    expect(membersToDetach(m, 2).map(x => x.id)).toEqual(['b', 'c'])
    expect(membersToDetach(m, 1).map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(membersToDetach(m, 0).map(x => x.id)).toEqual(['a', 'b', 'c']) // never detaches the owner
  })
})

describe('wiring', () => {
  test('invite route uses the hard-limit service and sends a token link, not ?ref=', () => {
    const r = read('src/app/api/team/invite/route.ts')
    expect(r).toMatch(/createTeamInvite\(/)
    expect(r).toMatch(/\/invite\/\$\{result\.token\}/)
    expect(r).not.toMatch(/sign-up\?ref=/)
  })
  test('sign-up carries invite and referral through to server landing pages', () => {
    const s = read('src/app/sign-up/[[...sign-up]]/page.tsx')
    expect(s).toMatch(/\/invite\/\$\{invite\}/)
    expect(s).toMatch(/\/join\?ref=/)
    expect(read('src/app/join/page.tsx')).toMatch(/claimReferral\(/)
  })
  test('acceptance is email-bound, single-use, seat-checked and plan-checked', () => {
    const s = read('src/lib/team-invites.ts')
    for (const n of ['emailsMatch(verifiedEmail', "eq(teamInvites.status, 'pending')", 'plan_inactive', 'seats_full', 'resolvePlan({ role: \'agent\'']) expect(s).toContain(n)
  })
  test('webhook enforces seats and marks link referrals upgraded', () => {
    const w = read('src/app/api/webhooks/stripe/route.ts')
    expect(w).toMatch(/enforceSeatLimits\(/)
    expect(w).toMatch(/markReferralsUpgraded\(/)
  })
  test('checkout and portal are owner-only', () => {
    expect(read('src/app/api/billing/create-checkout/route.ts')).toMatch(/role !== 'owner'/)
    expect(read('src/app/api/billing/portal/route.ts')).toMatch(/role !== 'owner'/)
  })
  test('every plan read goes through resolvePlan', () => {
    for (const p of ['src/lib/user-service.ts', 'src/lib/admin-data.ts', 'src/lib/social/digest.ts', 'src/lib/compliance/load.ts']) {
      expect(read(p), p).toMatch(/resolvePlan\(/)
    }
  })
})
