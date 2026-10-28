/**
 * Team-invite rules that need no database — token handling, seat math and role rules. Unit-tested.
 * The DB-backed flow lives in lib/team-invites.ts and calls these.
 */
import { createHash, randomBytes } from 'crypto'
import { seatLimitFor } from './plans'

export const INVITE_TTL_DAYS = 7
/** Invite farming guard: one organization can create at most this many invites per rolling 24h. */
export const MAX_INVITES_PER_ORG_PER_DAY = 10
export const INVITE_ROLES = ['admin', 'agent', 'viewer'] as const
export type InviteRole = (typeof INVITE_ROLES)[number]

/** 256-bit URL-safe token. Only its hash is stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
export const isPlausibleToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t)

export const normalizeEmail = (e: string) => e.trim().toLowerCase()

export function inviteExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
}

export interface SeatState { limit: number; members: number; pending: number; used: number; remaining: number; full: boolean }

/** Seats are consumed by members AND by live (unexpired, unaccepted) invites, so invites can never oversubscribe a plan. */
export function seatState(plan: string, members: number, pending: number): SeatState {
  const limit = seatLimitFor(plan)
  const used = members + pending
  return { limit, members, pending, used, remaining: Math.max(0, limit - used), full: used >= limit }
}

/** Only owners may mint admins; owners and admins may invite agents/viewers. Never 'owner'. */
export function canInviteRole(inviterRole: string, role: string): boolean {
  if (!(INVITE_ROLES as readonly string[]).includes(role)) return false
  if (inviterRole === 'owner') return true
  if (inviterRole === 'admin') return role !== 'admin'
  return false
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && normalizeEmail(a) === normalizeEmail(b)
}

/**
 * Which members to keep when an org's seat limit shrinks (downgrade). Owner first, then oldest membership; everyone past the limit
 * is detached to their own free workspace. Pure so it is testable.
 */
export function membersToDetach<T extends { id: string; role: string; createdAt: Date | string }>(members: T[], limit: number): T[] {
  const sorted = [...members].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (b.role === 'owner' && a.role !== 'owner') return 1
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  return sorted.slice(Math.max(1, limit))
}
