/**
 * One-line protection for every Claude-backed route that isn't /api/generate:
 *
 *   const blocked = await guardAi(userId, 'regenerate')
 *   if (blocked) return blocked
 *
 * Does, in order: per-user hourly rate limit (fails closed) -> spend-cap check -> reserves a
 * flat estimated cost against the daily/monthly counters (these routes don't track tokens).
 */
import { NextResponse } from 'next/server'
import { ApiError, handleApiError } from '@/lib/api-utils'
import { rateLimitAi, rateLimitHeaders } from '@/lib/ratelimit'
import { assertBudgetAvailable, addSpend } from '@/lib/ai-budget'

// perHour = max calls per user per hour; costUsd = deliberately high flat estimate per call.
const BUCKETS = {
  regenerate:           { perHour: 20, costUsd: 0.15 },
} as const

export type AiBucket = keyof typeof BUCKETS

export async function guardAi(userId: string, bucket: AiBucket): Promise<NextResponse | null> {
  try {
    const cfg = BUCKETS[bucket]
    const rl = await rateLimitAi(userId, bucket, cfg.perHour)
    if (!rl.success) throw new ApiError(429, 'You\'re doing that too quickly. Please try again in a little while.', rateLimitHeaders(rl))
    await assertBudgetAvailable(userId)
    await addSpend(userId, cfg.costUsd, bucket)
    return null
  } catch (err) {
    return handleApiError(err, { guard: bucket })
  }
}
