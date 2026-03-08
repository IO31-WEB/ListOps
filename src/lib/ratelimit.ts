/**
 * Rate Limiting — Upstash Redis
 *
 * If UPSTASH_REDIS_REST_URL is not set (local dev), rate limiting is bypassed.
 * Add to Vercel env vars to enable in production.
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

// ── Simple in-memory fallback (used when Upstash not configured) ──
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

// ── Upstash Redis rate limiter (production) ───────────────────────
async function upstashRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!

  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // MULTI: INCR + EXPIRE in one pipeline
  const pipeline = [
    ['INCR', key],
    ['PTTL', key],
  ]

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
  })

  if (!res.ok) {
    // Redis error — fail open (don't block users if Redis is down)
    console.error('Upstash rate limit error:', await res.text())
    return { success: true, remaining: limit, reset: now + windowMs, limit }
  }

  const data = await res.json()
  const count: number = data[0]?.result ?? 1
  const pttl: number = data[1]?.result ?? -1

  // Set expiry on first request
  if (count === 1 || pttl < 0) {
    await fetch(`${url}/pexpire/${encodeURIComponent(key)}/${windowMs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  const resetAt = pttl > 0 ? now + pttl : now + windowMs
  const remaining = Math.max(0, limit - count)

  return { success: count <= limit, remaining, reset: resetAt, limit }
}

// ── Public API ────────────────────────────────────────────────────
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
