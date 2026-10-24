/**
 * Short-lived signed token that lets our headless browser (PDF renderer, which has no Clerk session) open ONE
 * campaign's flyer page. HMAC-SHA256 over "flyer:<campaignId>:<expiry>" keyed by a server secret; 3-minute life.
 */
import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  const s = process.env.PRINT_TOKEN_SECRET || process.env.CLERK_SECRET_KEY
  if (!s) throw new Error('No signing secret configured')
  return s
}
const sig = (campaignId: string, exp: number) => createHmac('sha256', secret()).update(`flyer:${campaignId}:${exp}`).digest('hex')

export function signPrintToken(campaignId: string, ttlMs = 3 * 60 * 1000): string {
  const exp = Date.now() + ttlMs
  return `${exp}.${sig(campaignId, exp)}`
}

export function verifyPrintToken(campaignId: string, token: string | undefined | null): boolean {
  if (!token) return false
  try {
    const [expStr, mac] = token.split('.')
    const exp = Number(expStr)
    if (!Number.isFinite(exp) || exp < Date.now() || !mac) return false
    const a = Buffer.from(mac, 'hex'), b = Buffer.from(sig(campaignId, exp), 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
