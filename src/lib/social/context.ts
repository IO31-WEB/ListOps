import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { ApiError } from '@/lib/api-utils'
import { checkCampaignQuota } from '@/lib/user-service'
import { rateLimitHeaders, rateLimitSocial } from '@/lib/ratelimit'
import { canAccess } from '@/lib/plans'
import { isValidTimeZone } from './time'

/** Signed-in agent for the social queue: rate limit, plan gate (Pro+), and their time zone. */
export async function loadSocialContext(clerkId: string) {
  const rl = await rateLimitSocial(clerkId)
  if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId), columns: { id: true, email: true, timezone: true, deletedAt: true } })
  if (!user || user.deletedAt) throw new ApiError(404, 'Account not found')
  const { planTier } = await checkCampaignQuota(clerkId)
  if (!canAccess(planTier, 'social_scheduling')) throw new ApiError(403, 'The social calendar is available on the Pro plan and above.')
  return { user, plan: planTier, tz: isValidTimeZone(user.timezone) ? user.timezone : 'America/New_York' }
}
