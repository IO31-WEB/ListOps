import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { ApiError } from '@/lib/api-utils'
import { checkCampaignQuota } from '@/lib/user-service'
import { rateLimitHeaders, rateLimitLeadTools } from '@/lib/ratelimit'
import { canAccess, type Feature } from '@/lib/plans'

/** Resolves the signed-in agent (DB row + plan) and applies the shared per-user rate limit for lead tools. */
export async function loadLeadContext(clerkId: string) {
  const rl = await rateLimitLeadTools(clerkId)
  if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  if (!user || user.deletedAt) throw new ApiError(404, 'Account not found')
  const { planTier } = await checkCampaignQuota(clerkId)
  return { user, plan: planTier }
}

export function requireFeature(plan: Parameters<typeof canAccess>[0], feature: Feature, message: string) {
  if (!canAccess(plan, feature)) throw new ApiError(403, message)
}
