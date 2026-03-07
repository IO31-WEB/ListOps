/**
 * CampaignAI — User & Organization Service
 * Complete database operations layer
 */

import { db } from './db'
import { users, organizations, brandKits, subscriptions, campaigns, auditLogs } from './db/schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { generateReferralCode, slugify } from './utils'
import type { PlanTier } from './stripe'
import { clerkClient } from '@clerk/nextjs/server'

// ── Get or create user from Clerk ────────────────────────────

export async function getOrCreateUser(clerkId: string, data: {
  email: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
}) {
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    with: { organization: true, brandKit: true },
  })
  if (existing) return existing

  const orgSlug = slugify(`${data.firstName || 'agent'}-${data.email.split('@')[0]}`)
  const [org] = await db.insert(organizations).values({
    name: `${data.firstName ?? 'Agent'}'s Workspace`,
    slug: `${orgSlug}-${Date.now()}`,
    plan: 'free',
  }).returning()

  const referralCode = generateReferralCode(`${data.firstName ?? ''}${data.lastName ?? ''}` || data.email)
  const [user] = await db.insert(users).values({
    clerkId, orgId: org.id, email: data.email,
    firstName: data.firstName, lastName: data.lastName,
    avatarUrl: data.avatarUrl, referralCode, role: 'owner',
  }).returning()

  await db.insert(subscriptions).values({
    orgId: org.id, userId: user.id, plan: 'free', status: 'active',
  })

  return db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: { organization: true, brandKit: true },
  })
}

export async function getUserWithDetails(clerkId: string) {
  await syncPlanFromClerkMetadata(clerkId)
  return db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    with: { organization: { with: { subscriptions: true } }, brandKit: true },
  })
}

export async function getOrgSubscription(orgId: string) {
  return db.query.subscriptions.findFirst({
    where: eq(subscriptions.orgId, orgId),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  })
}

export async function syncSubscription(orgId: string, data: {
  stripeSubscriptionId: string
  stripePriceId: string
  plan: PlanTier
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused'
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}) {
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.orgId, orgId),
  })

  if (existing) {
    await db.update(subscriptions).set({
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripePriceId: data.stripePriceId,
      plan: data.plan, status: data.status,
      stripeCurrentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      updatedAt: new Date(),
    }).where(eq(subscriptions.orgId, orgId))
  } else {
    await db.insert(subscriptions).values({
      orgId, stripeSubscriptionId: data.stripeSubscriptionId,
      stripePriceId: data.stripePriceId, plan: data.plan,
      status: data.status, stripeCurrentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    })
  }

  await db.update(organizations)
    .set({ plan: data.plan, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

export async function downgradeToFree(orgId: string) {
  await db.update(organizations)
    .set({ plan: 'free', updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
  await db.update(subscriptions)
    .set({ plan: 'free', status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.orgId, orgId))
}

// ── Sync plan from Clerk privateMetadata → DB ────────────────
// This lets you override the plan in Clerk dashboard without needing Stripe.
// Accepts either privateMetadata.planTier OR privateMetadata.plan (both work)
export async function syncPlanFromClerkMetadata(clerkId: string): Promise<PlanTier | null> {
  try {
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkId)
    const meta = clerkUser.privateMetadata as Record<string, any>

    // Accept both 'planTier' and 'plan' as the metadata key
    const rawTier = (meta?.planTier ?? meta?.plan) as string | undefined
    const validTiers: PlanTier[] = ['free', 'starter', 'pro', 'brokerage', 'enterprise']
    const clerkTier = (rawTier && validTiers.includes(rawTier as PlanTier))
      ? rawTier as PlanTier
      : null

    if (!clerkTier) return null

    // Find the user's org and update the DB subscription to match
    let user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      with: { organization: true },
    })

    // If user has no org yet, create one so the plan can be stored
    if (user && !user.orgId) {
      const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? ''
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email
      const [newOrg] = await db.insert(organizations).values({
        name: `${name}'s Organization`,
        plan: clerkTier,
      }).returning()
      await db.update(users)
        .set({ orgId: newOrg.id, updatedAt: new Date() })
        .where(eq(users.clerkId, clerkId))
      user = { ...user, orgId: newOrg.id }
    }

    if (!user?.orgId) return clerkTier

    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.orgId, user.orgId),
    })

    if (existing) {
      if (existing.plan !== clerkTier) {
        await db.update(subscriptions)
          .set({ plan: clerkTier, status: 'active', updatedAt: new Date() })
          .where(eq(subscriptions.orgId, user.orgId))
        await db.update(organizations)
          .set({ plan: clerkTier, updatedAt: new Date() })
          .where(eq(organizations.id, user.orgId))
      }
    } else {
      await db.insert(subscriptions).values({
        orgId: user.orgId,
        plan: clerkTier,
        status: 'active',
        stripeSubscriptionId: `clerk_manual_${clerkId}`,
        stripePriceId: `clerk_manual_${clerkTier}`,
        stripeCurrentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      })
      await db.update(organizations)
        .set({ plan: clerkTier, updatedAt: new Date() })
        .where(eq(organizations.id, user.orgId))
    }

    return clerkTier
  } catch (err) {
    console.error('syncPlanFromClerkMetadata error (non-fatal):', err)
    return null
  }
}

export async function upsertBrandKit(userId: string, orgId: string, data: Partial<typeof brandKits.$inferInsert>) {
  const existing = await db.query.brandKits.findFirst({ where: eq(brandKits.userId, userId) })
  if (existing) {
    const [updated] = await db.update(brandKits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(brandKits.userId, userId))
      .returning()
    return updated
  }
  const [created] = await db.insert(brandKits).values({ userId, orgId, ...data }).returning()
  return created
}

export async function checkCampaignQuota(clerkId: string): Promise<{
  allowed: boolean; used: number; limit: number | 'unlimited'; planTier: PlanTier; resetsAt?: Date
}> {
  // Sync from Clerk metadata first (allows manual plan overrides via Clerk dashboard)
  await syncPlanFromClerkMetadata(clerkId)

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    with: { organization: { with: { subscriptions: true } } },
  })
  if (!user) return { allowed: false, used: 0, limit: 0, planTier: 'free' }

  const sub = user.organization?.subscriptions?.[0]
  const plan = (sub?.plan ?? 'free') as PlanTier
  const limits: Record<PlanTier, number | 'unlimited'> = {
    free: 3, starter: 5, pro: 'unlimited', brokerage: 'unlimited', enterprise: 'unlimited',
  }
  const limit = limits[plan]

  const now = new Date()
  const lastReset = new Date(user.lastResetAt)
  const needsReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()
  if (needsReset) {
    await db.update(users).set({ campaignsUsedThisMonth: 0, lastResetAt: now }).where(eq(users.id, user.id))
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { allowed: true, used: 0, limit, planTier: plan, resetsAt: nextReset }
  }

  const used = user.campaignsUsedThisMonth
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { allowed: limit === 'unlimited' || used < limit, used, limit, planTier: plan, resetsAt: nextReset }
}

export async function incrementCampaignUsage(clerkId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  if (!user) return
  await db.update(users).set({
    campaignsUsedThisMonth: user.campaignsUsedThisMonth + 1,
    campaignsUsedTotal: user.campaignsUsedTotal + 1,
  }).where(eq(users.id, user.id))
}

export async function getDashboardStats(clerkId: string) {
  await syncPlanFromClerkMetadata(clerkId)
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    with: { organization: { with: { subscriptions: true } }, brandKit: true },
  })
  if (!user) return null

  const sub = user.organization?.subscriptions?.[0]
  const planTier = (sub?.plan ?? 'free') as PlanTier

  const [totalResult, recentCampaigns, genTimeResult, viewsResult] = await Promise.all([
    db.select({ count: count() }).from(campaigns).where(eq(campaigns.agentId, user.id)),
    db.query.campaigns.findMany({
      where: eq(campaigns.agentId, user.id),
      orderBy: [desc(campaigns.createdAt)],
      limit: 5,
      with: { listing: true },
    }),
    db.select({ avg: sql<number>`avg(generation_ms)` })
      .from(campaigns)
      .where(and(eq(campaigns.agentId, user.id), eq(campaigns.status, 'complete'))),
    db.select({ total: sql<number>`coalesce(sum(microsite_views), 0)` })
      .from(campaigns)
      .where(eq(campaigns.agentId, user.id)),
  ])

  const limits: Record<PlanTier, number | 'unlimited'> = {
    free: 3, starter: 5, pro: 'unlimited', brokerage: 'unlimited', enterprise: 'unlimited',
  }
  const now = new Date()
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const daysUntilReset = Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    user, planTier,
    totalCampaigns: totalResult[0]?.count ?? 0,
    campaignsThisMonth: user.campaignsUsedThisMonth,
    campaignLimit: limits[planTier],
    recentCampaigns,
    avgGenTimeMs: Math.round(genTimeResult[0]?.avg ?? 0),
    micrositeViews: viewsResult[0]?.total ?? 0,
    daysUntilReset,
    hasBrandKit: !!user.brandKit,
    brandKit: user.brandKit,
    subscription: sub,
    organization: user.organization,
  }
}

export async function getUserCampaigns(clerkId: string, page = 1, pageLimit = 20) {
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  if (!user) return { campaigns: [], total: 0, pages: 0 }

  const offset = (page - 1) * pageLimit
  const [allCampaigns, totalResult] = await Promise.all([
    db.query.campaigns.findMany({
      where: eq(campaigns.agentId, user.id),
      orderBy: [desc(campaigns.createdAt)],
      limit: pageLimit, offset,
      with: { listing: true },
    }),
    db.select({ count: count() }).from(campaigns).where(eq(campaigns.agentId, user.id)),
  ])

  return {
    campaigns: allCampaigns,
    total: totalResult[0]?.count ?? 0,
    pages: Math.ceil((totalResult[0]?.count ?? 0) / pageLimit),
  }
}

export async function getCampaign(campaignId: string, clerkId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  if (!user) return null
  return db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.agentId, user.id)),
    with: { listing: true, brandKit: true },
  })
}

export async function getTeamMembers(orgId: string) {
  return db.query.users.findMany({
    where: eq(users.orgId, orgId),
    orderBy: [desc(users.createdAt)],
    with: { brandKit: true },
  })
}

export async function updateUserProfile(clerkId: string, data: {
  firstName?: string; lastName?: string; phone?: string
  licenseNumber?: string; mlsAgentId?: string; timezone?: string
  aiPersona?: { tone: 'professional' | 'friendly' | 'luxury' | 'energetic'; writingStyle: string; tagline: string; specialties: string[]; marketArea: string }
}) {
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  if (!user) throw new Error('User not found')
  const [updated] = await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning()
  return updated
}

export async function updateWhiteLabel(orgId: string, data: {
  customAppName?: string; customLogoUrl?: string; customFaviconUrl?: string
  customPrimaryColor?: string; customAccentColor?: string
  customSupportEmail?: string; hidePoweredBy?: boolean
}) {
  const [updated] = await db.update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning()
  return updated
}

export async function writeAuditLog(data: {
  orgId?: string; userId?: string; action: string
  resourceType?: string; resourceId?: string
  metadata?: Record<string, unknown>; ipAddress?: string; userAgent?: string
}) {
  try {
    await db.insert(auditLogs).values({
      orgId: data.orgId, userId: data.userId, action: data.action,
      resourceType: data.resourceType, resourceId: data.resourceId,
      metadata: data.metadata, ipAddress: data.ipAddress as any,
      userAgent: data.userAgent,
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}
