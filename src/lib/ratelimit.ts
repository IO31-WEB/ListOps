/**
 * Rate Limiting — Upstash Redis (with safe fallbacks)
 *
 * Policy (important):
 *  - COST-SENSITIVE routes (generate, enrich, uploads, contact) FAIL CLOSED to a
 *    per-instance in-memory limiter when Redis is unavailable. Before this change a
 *    Redis outage (e.g. a deleted free-tier DB) silently removed all protection.
 *  - Non-sensitive routes fail open so a Redis blip never takes the app down.
 *
 * The in-memory fallback is per serverless instance, so it is weaker than Redis,
 * but it still caps a single abusive client far below "unlimited".
 */

import { captureError } from '@/lib/monitoring'

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number // unix ms
  limit: number
}

const memStore = new Map<string, { count: number; resetAt: number }>()

function memRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  // opportunistic cleanup so the map can't grow without bound
  if (memStore.size > 5000) {
    for (const [k, v] of memStore) if (v.resetAt < now) memStore.delete(k)
  }
  const entry = memStore.get(key)
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, reset: now + windowMs, limit }
  }
  entry.count++
  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.resetAt,
    limit,
  }
}

let lastRedisAlert = 0
function alertRedisDown(detail: unknown) {
  // Alert at most once every 10 minutes so Sentry isn't flooded.
  if (Date.now() - lastRedisAlert < 10 * 60 * 1000) return
  lastRedisAlert = Date.now()
  captureError(new Error('Upstash rate limiter unavailable'), { detail: String(detail) })
}

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // Atomic: SET NX EX (init with TTL) -> INCR -> PTTL
  const pipeline = [
    ['SET', key, '0', 'NX', 'EX', String(windowSeconds)],
    ['INCR', key],
    ['PTTL', key],
  ]

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeline),
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) {
      alertRedisDown(`status ${res.status}`)
      return null
    }
    const data = await res.json()
    const count: number = data[1]?.result ?? 1
    const pttl: number = data[2]?.result ?? windowMs
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      reset: pttl > 0 ? now + pttl : now + windowMs,
      limit,
    }
  } catch (err) {
    alertRedisDown(err)
    return null
  }
}

interface Policy {
  name: string
  limit: number
  windowSeconds: number
  /** true = if Redis is down, use the in-memory limiter (strict). false = allow. */
  failClosed: boolean
}

async function limit(policy: Policy, id: string): Promise<RateLimitResult> {
  const key = `rl:${policy.name}:${id}`
  const viaRedis = await upstashRateLimit(key, policy.limit, policy.windowSeconds)
  if (viaRedis) return viaRedis
  if (policy.failClosed) return memRateLimit(key, policy.limit, policy.windowSeconds * 1000)
  return {
    success: true,
    remaining: policy.limit,
    reset: Date.now() + policy.windowSeconds * 1000,
    limit: policy.limit,
  }
}

// ── Policies ───────────────────────────────────────────────────
export const rateLimitGenerate = (userId: string) =>
  limit({ name: 'generate', limit: 5, windowSeconds: 10 * 60, failClosed: true }, userId)

/** Any Claude-backed route besides /api/generate. Per-bucket hourly cap, fails closed. */
export const rateLimitAi = (userId: string, bucket: string, perHour: number) =>
  limit({ name: `ai-${bucket}`, limit: perHour, windowSeconds: 60 * 60, failClosed: true }, userId)

/** Stripe checkout / portal session creation. */
export const rateLimitBilling = (userId: string) =>
  limit({ name: 'billing', limit: 10, windowSeconds: 60 * 60, failClosed: true }, userId)

/** PDF rendering launches a headless browser — expensive. */
export const rateLimitPdf = (userId: string) =>
  limit({ name: 'pdf', limit: 10, windowSeconds: 10 * 60, failClosed: true }, userId)

/** Visual-kit image renders (previews + downloads). Cheaper than a PDF render, but still CPU. */
export const rateLimitVisualKit = (userId: string) =>
  limit({ name: 'visual-kit', limit: 120, windowSeconds: 10 * 60, failClosed: true }, userId)

/** Referral-code redemption (stops brute-forcing codes). */
export const rateLimitReferral = (userId: string) =>
  limit({ name: 'referral', limit: 10, windowSeconds: 60 * 60, failClosed: true }, userId)

/** Admin mutations: generous for a human, tiny for a stolen session. */
export const rateLimitAdmin = (adminClerkId: string) =>
  limit({ name: 'admin', limit: 60, windowSeconds: 10 * 60, failClosed: true }, adminClerkId)

/** Outreach email sends: 10 batches / day / user (each batch capped at 100 recipients in the route). */
export const rateLimitEmailSend = (userId: string) =>
  limit({ name: 'email-send', limit: 10, windowSeconds: 24 * 60 * 60, failClosed: true }, userId)

/** Address enrichment calls a paid third-party API. */
export const rateLimitEnrich = (userId: string) =>
  limit({ name: 'enrich', limit: 20, windowSeconds: 60 * 60, failClosed: true }, userId)

/** Photo uploads: 40 per 10 min per user. */
export const rateLimitUpload = (userId: string) =>
  limit({ name: 'upload', limit: 40, windowSeconds: 10 * 60, failClosed: true }, userId)

/** Listing create/update. */
export const rateLimitListingWrite = (userId: string) =>
  limit({ name: 'listing-write', limit: 60, windowSeconds: 60 * 60, failClosed: false }, userId)

/** Public contact form — keyed by IP. */
export const rateLimitContact = (ip: string) =>
  limit({ name: 'contact', limit: 3, windowSeconds: 60 * 60, failClosed: true }, ip)

export const rateLimitAPI = (ip: string) =>
  limit({ name: 'api', limit: 60, windowSeconds: 60, failClosed: false }, ip)

export function rateLimitHeaders(rl: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.reset),
    'Retry-After': String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
  }
}
