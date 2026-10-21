/**
 * Signed unsubscribe links (CAN-SPAM). The token is an HMAC of the email address, so links
 * cannot be forged to unsubscribe other people, and no database lookup is needed to verify.
 * Requires UNSUBSCRIBE_SECRET (any long random string). Without it, marketing sends are refused.
 */
import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s || s.length < 16) throw new Error('UNSUBSCRIBE_SECRET is not configured (min 16 chars)')
  return s
}

const b64u = (b: Buffer) => b.toString('base64url')

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function signEmail(email: string): string {
  return b64u(createHmac('sha256', secret()).update(normalizeEmail(email)).digest())
}

export function verifyEmailToken(email: string, token: string): boolean {
  try {
    const expected = Buffer.from(signEmail(email))
    const given = Buffer.from(token)
    return expected.length === given.length && timingSafeEqual(expected, given)
  } catch {
    return false
  }
}

/** Human-clickable page (GET unsubscribes immediately — a single page visit, as CAN-SPAM requires). */
export function unsubscribePageUrl(email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listops.io'
  const e = Buffer.from(normalizeEmail(email)).toString('base64url')
  return `${base}/unsubscribe?e=${e}&t=${signEmail(email)}`
}

/** One-click endpoint for the List-Unsubscribe header (RFC 8058 — mail clients POST here). */
export function unsubscribeApiUrl(email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listops.io'
  const e = Buffer.from(normalizeEmail(email)).toString('base64url')
  return `${base}/api/unsubscribe?e=${e}&t=${signEmail(email)}`
}

export function decodeEmailParam(e: string): string | null {
  try {
    const email = Buffer.from(e, 'base64url').toString('utf8')
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? normalizeEmail(email) : null
  } catch {
    return null
  }
}
