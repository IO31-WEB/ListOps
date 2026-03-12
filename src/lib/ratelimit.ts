/**
 * Rate Limiting — Upstash Redis
 *
 * FIX: The previous implementation had a race condition between INCR and PEXPIRE.
 * If the process crashed between those two calls, a key could exist forever with
 * no TTL, permanently blocking a user.
 *
 * Fix: Use SET NX (set-if-not-exists) to initialize the counter with an expiry
 * atomically, then INCR. This is the standard Redis rate limiting pattern.
 *
 * If UPSTASH_REDIS_REST_URL is not set (local dev), falls back to in-memory.
 *
 * Limits:
 *   /api/generate  — 5 req / 10 min per user  (Claude cost protection)
 *   /api/*         — 60 req / 1 min per IP    (general API abuse)
 */

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number // unix ms
  limit: number
}

// ── In-memory fallback (local dev only) ──────────────────────
const memStore = new Map<string, { count: number; resetAt: number }>()

function memRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)

  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, reset: now + windowMs, limit }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  return {
    success: entry.count <= limit,
    remaining,
    reset: entry.resetAt,
    limit,
  }
}

// ── Upstash Redis rate limiter (production) ───────────────────
// FIX: Uses SET NX EX (atomic init with TTL) + INCR pattern.
// No window between key creation and expiry set — race condition eliminated.
async function upstashRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // Pipeline:
  // 1. SET key 0 NX EX windowSeconds  — initialize to 0 with TTL if key doesn't exist
  // 2. INCR key                        — atomically increment
  // 3. PTTL key                        — get remaining TTL in ms
  const pipeline = [
    ['SET', key, '0', 'NX', 'EX', String(windowSeconds)],
    ['INCR', key],
    ['PTTL', key],
  ]

  let res: Response
  try {
    res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    })
  } catch (err) {
    // Network error — fail open so users aren't blocked by Redis downtime
    console.error('[ratelimit] Upstash network error (failing open):', err)
    return { success: true, remaining: limit, reset: now + windowMs, limit }
  }

  if (!res.ok) {
    console.error('[ratelimit] Upstash error response (failing open):', res.status)
    return { success: true, remaining: limit, reset: now + windowMs, limit }
  }

  const data = await res.json()
  const count: number = data[1]?.result ?? 1
  const pttl: number  = data[2]?.result ?? windowMs

  const resetAt = pttl > 0 ? now + pttl : now + windowMs
  const remaining = Math.max(0, limit - count)

  return { success: count <= limit, remaining, reset: resetAt, limit }
}

// ── Public API ─────────────────────────────────────────────────
const hasUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

/**
 * Rate limit the campaign generation endpoint.
 * 5 generations per 10 minutes per user.
 */
export async function rateLimitGenerate(userId: string): Promise<RateLimitResult> {
  const key = `rl:generate:${userId}`
  if (!hasUpstash) return memRateLimit(key, 5, 10 * 60 * 1000)
  return upstashRateLimit(key, 5, 10 * 60)
}

/**
 * Rate limit general API endpoints.
 * 60 requests per minute per IP.
 */
export async function rateLimitAPI(ip: string): Promise<RateLimitResult> {
  const key = `rl:api:${ip}`
  if (!hasUpstash) return memRateLimit(key, 60, 60 * 1000)
  return upstashRateLimit(key, 60, 60)
}

