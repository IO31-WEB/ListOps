/**
 * Anthropic spend protection — three layers (defense in depth):
 *
 *  1. HARD LIMIT AT THE SOURCE (do this first, it cannot be bypassed by a code bug):
 *     console.anthropic.com -> Settings -> Limits -> set a monthly spend limit, and
 *     add a usage-alert email. Use a dedicated workspace/key just for ListOps.
 *  2. PER-USER + GLOBAL DAILY CAPS (this file): estimated $ spend is tracked in Redis.
 *     When a cap is hit, generation is refused with a friendly message.
 *  3. RATE LIMITS (ratelimit.ts): generate is 5 / 10 min / user and fails closed.
 *
 * Costs are ESTIMATES from token usage. The default per-million-token prices are
 * intentionally on the high side so the caps trip early rather than late. Override
 * with env vars if your model pricing differs.
 */

import { redisPipeline } from '@/lib/redis'
import { ApiError } from '@/lib/api-utils'
import { captureError } from '@/lib/monitoring'

const num = (v: string | undefined, d: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : d
}

const CFG = {
  globalDailyUsd: () => num(process.env.AI_DAILY_BUDGET_USD, 40),
  globalMonthlyUsd: () => num(process.env.AI_MONTHLY_BUDGET_USD, 400),
  userDailyUsd: () => num(process.env.AI_USER_DAILY_BUDGET_USD, 4),
  inPerMTok: () => num(process.env.AI_COST_PER_MTOK_IN, 5),
  outPerMTok: () => num(process.env.AI_COST_PER_MTOK_OUT, 25),
}

const day = () => new Date().toISOString().slice(0, 10)
const month = () => new Date().toISOString().slice(0, 7)

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1e6) * CFG.inPerMTok() + (outputTokens / 1e6) * CFG.outPerMTok()
}

/** Throws ApiError(429/503) if any cap is already exhausted. Call BEFORE the Claude request. */
export async function assertBudgetAvailable(userId: string): Promise<void> {
  const res = await redisPipeline([
    ['GET', `ai:spend:day:${day()}`],
    ['GET', `ai:spend:month:${month()}`],
    ['GET', `ai:spend:user:${userId}:${day()}`],
  ])
  if (!res) return // Redis down: rate limiter (fail-closed) + Anthropic console limit still protect us

  const [gDay, gMonth, uDay] = res.map(r => Number(r.result ?? 0))
  if (gDay >= CFG.globalDailyUsd() || gMonth >= CFG.globalMonthlyUsd()) {
    captureError(new Error('AI global budget cap reached'), { gDay, gMonth })
    throw new ApiError(503, 'Campaign generation is temporarily unavailable. Please try again later.')
  }
  if (uDay >= CFG.userDailyUsd()) {
    throw new ApiError(429, "You've reached today's generation limit. Please try again tomorrow.")
  }
}

/** Record spend after a call completes (best-effort; never throws). */
export async function recordSpend(userId: string, inputTokens: number, outputTokens: number): Promise<number> {
  return addSpend(userId, estimateCostUsd(inputTokens, outputTokens))
}

/** Add a flat dollar amount to the counters (used to reserve cost up-front for routes without token accounting). */
export async function addSpend(userId: string, cost: number): Promise<number> {
  await redisPipeline([
    ['INCRBYFLOAT', `ai:spend:day:${day()}`, cost],
    ['EXPIRE', `ai:spend:day:${day()}`, 60 * 60 * 48],
    ['INCRBYFLOAT', `ai:spend:month:${month()}`, cost],
    ['EXPIRE', `ai:spend:month:${month()}`, 60 * 60 * 24 * 40],
    ['INCRBYFLOAT', `ai:spend:user:${userId}:${day()}`, cost],
    ['EXPIRE', `ai:spend:user:${userId}:${day()}`, 60 * 60 * 48],
  ])
  return cost
}
