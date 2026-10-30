/**
 * Read-side queries for the admin portal. Every export here is called ONLY from pages/routes that have already
 * passed requireAdminPage()/requireAdminApi(). They intentionally select explicit columns — never `select *` —
 * so secrets and large JSON blobs aren't pulled into admin pages.
 */
import { and, count, desc, eq, gte, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiUsage, auditLogs, campaigns, listings, users } from '@/lib/db/schema'
import { stripe } from '@/lib/stripe'
import { CAMPAIGN_LIMITS } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'
import { resolvePlan } from '@/lib/plan-resolve'
import { effectiveUsed } from '@/lib/quota-period'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)

type UserWithPlan = {
  role?: string | null
  organization?: { plan?: string | null; subscriptions?: Array<{ plan?: string | null; status?: string | null; stripeCurrentPeriodEnd?: Date | null }> | null } | null
}

/**
 * Generations used in the CURRENT billing period. The stored counter is reset lazily (on the user's next generation
 * or by the daily sweep), so the admin views must not show the raw column — it keeps last period's number for
 * anyone who hasn't been active since the rollover.
 */
export function usedThisPeriodOf(u: UserWithPlan & { campaignsUsedThisMonth: number; lastResetAt: Date }): number {
  const periodEnd = u.organization?.subscriptions?.[0]?.stripeCurrentPeriodEnd ?? null
  return effectiveUsed(u, periodEnd)
}

/** Effective plan (see lib/plan-resolve.ts): members only inherit while the org subscription is active/trialing. */
export function planOf(u: UserWithPlan): string {
  return resolvePlan(u)
}

export function monthlyLimitOf(plan: string): number | 'unlimited' {
  // Same table the quota system itself enforces (lib/user-service.ts), so the admin view can never disagree with it.
  return CAMPAIGN_LIMITS[plan as PlanTier] ?? 3
}

const userColumns = {
  id: true, clerkId: true, email: true, firstName: true, lastName: true, role: true, createdAt: true,
  campaignsUsedThisMonth: true, campaignsUsedTotal: true, lastResetAt: true,
  ageConfirmedAt: true, ageBlockedAt: true, deletedAt: true, onboardingComplete: true,
} as const

const withPlan = { organization: { with: { subscriptions: true } } } as const

export async function searchUsers(q: string) {
  const term = q.trim().slice(0, 100)
  const where = !term
    ? undefined
    : UUID_RE.test(term)
      ? eq(users.id, term)
      : term.startsWith('user_')
        ? eq(users.clerkId, term)
        : or(ilike(users.email, `%${escapeLike(term)}%`), ilike(users.lastName, `%${escapeLike(term)}%`))
  return db.query.users.findMany({ where, columns: userColumns, with: withPlan, orderBy: [desc(users.createdAt)], limit: 25 })
}

export async function getUserDetail(id: string) {
  if (!UUID_RE.test(id)) return null
  const user = await db.query.users.findFirst({ where: eq(users.id, id), columns: userColumns, with: withPlan })
  if (!user) return null

  const [recentCampaigns, usage30d, recentUsage, auditEntries] = await Promise.all([
    db
      .select({
        id: campaigns.id, status: campaigns.status, createdAt: campaigns.createdAt, generationMs: campaigns.generationMs,
        failureReason: campaigns.failureReason, refundedAt: campaigns.refundedAt,
        address: listings.address, city: listings.city, state: listings.state,
      })
      .from(campaigns)
      .leftJoin(listings, eq(campaigns.listingId, listings.id))
      .where(eq(campaigns.agentId, id))
      .orderBy(desc(campaigns.createdAt))
      .limit(20),
    db
      .select({ cost: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)`, calls: count() })
      .from(aiUsage)
      .where(and(eq(aiUsage.clerkId, user.clerkId), gte(aiUsage.createdAt, daysAgo(30)))),
    db
      .select({ kind: aiUsage.kind, cost: aiUsage.costUsd, inTok: aiUsage.inputTokens, outTok: aiUsage.outputTokens, at: aiUsage.createdAt })
      .from(aiUsage)
      .where(eq(aiUsage.clerkId, user.clerkId))
      .orderBy(desc(aiUsage.createdAt))
      .limit(10),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, metadata: auditLogs.metadata, at: auditLogs.createdAt })
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
  ])

  const plan = planOf(user)
  return {
    user, plan, limit: monthlyLimitOf(plan), usedThisPeriod: usedThisPeriodOf(user),
    recentCampaigns, recentUsage, auditEntries,
    spend30d: { cost: Number(usage30d[0]?.cost ?? 0), calls: Number(usage30d[0]?.calls ?? 0) },
  }
}

export async function getRecentFailures(limit = 50, sinceDays?: number) {
  return db
    .select({
      id: campaigns.id, createdAt: campaigns.createdAt, failureReason: campaigns.failureReason, refundedAt: campaigns.refundedAt,
      generationMs: campaigns.generationMs, userId: users.id, email: users.email,
      address: listings.address, city: listings.city, state: listings.state,
    })
    .from(campaigns)
    .leftJoin(users, eq(campaigns.agentId, users.id))
    .leftJoin(listings, eq(campaigns.listingId, listings.id))
    .where(sinceDays ? and(eq(campaigns.status, 'failed'), gte(campaigns.createdAt, daysAgo(sinceDays))) : eq(campaigns.status, 'failed'))
    .orderBy(desc(campaigns.createdAt))
    .limit(limit)
}

export async function countFailures(sinceDays: number): Promise<number> {
  const [r] = await db.select({ n: count() }).from(campaigns).where(and(eq(campaigns.status, 'failed'), gte(campaigns.createdAt, daysAgo(sinceDays))))
  return Number(r?.n ?? 0)
}

export async function getSpendOverview() {
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
  const startOfMonth = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1))
  const sum = sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)`

  const [today, month, byDay, byKind, top] = await Promise.all([
    db.select({ cost: sum, calls: count() }).from(aiUsage).where(gte(aiUsage.createdAt, startOfDay)),
    db.select({ cost: sum, calls: count() }).from(aiUsage).where(gte(aiUsage.createdAt, startOfMonth)),
    db
      .select({ day: sql<string>`to_char(${aiUsage.createdAt}, 'YYYY-MM-DD')`, cost: sum, calls: count() })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, daysAgo(14)))
      .groupBy(sql`1`)
      .orderBy(sql`1 desc`),
    db
      .select({ kind: aiUsage.kind, cost: sum, calls: count() })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, startOfMonth))
      .groupBy(aiUsage.kind)
      .orderBy(sql`2 desc`),
    db
      .select({ clerkId: aiUsage.clerkId, email: users.email, userId: users.id, cost: sum, calls: count() })
      .from(aiUsage)
      .leftJoin(users, eq(users.clerkId, aiUsage.clerkId))
      .where(gte(aiUsage.createdAt, startOfMonth))
      .groupBy(aiUsage.clerkId, users.email, users.id)
      .orderBy(sql`4 desc`)
      .limit(8),
  ])
  return {
    today: { cost: Number(today[0]?.cost ?? 0), calls: Number(today[0]?.calls ?? 0) },
    month: { cost: Number(month[0]?.cost ?? 0), calls: Number(month[0]?.calls ?? 0) },
    byDay: byDay.map(r => ({ day: r.day, cost: Number(r.cost), calls: Number(r.calls) })),
    byKind: byKind.map(r => ({ kind: r.kind, cost: Number(r.cost), calls: Number(r.calls) })),
    top: top.map(r => ({ clerkId: r.clerkId, email: r.email, userId: r.userId, cost: Number(r.cost), calls: Number(r.calls) })),
  }
}

export async function getOverviewCounts() {
  const [total, week] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, daysAgo(7))),
  ])
  return { totalUsers: Number(total[0]?.n ?? 0), newUsers7d: Number(week[0]?.n ?? 0) }
}

export async function getAuditLog(opts: { limit?: number; actionPrefix?: string } = {}) {
  const prefix = opts.actionPrefix?.replace(/[^a-z._]/gi, '').slice(0, 30)
  return db
    .select({
      id: auditLogs.id, action: auditLogs.action, metadata: auditLogs.metadata, at: auditLogs.createdAt, ip: auditLogs.ipAddress,
      resourceId: auditLogs.resourceId, resourceType: auditLogs.resourceType, targetEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.resourceId, users.id))
    .where(prefix ? ilike(auditLogs.action, `${escapeLike(prefix)}%`) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(opts.limit ?? 100)
}

/** Read-only content snapshot for "view as user". Explicit columns; no secrets. */
export async function getViewAsUser(id: string) {
  const detail = await getUserDetail(id)
  if (!detail) return null
  const rows = await db.query.campaigns.findMany({
    where: eq(campaigns.agentId, id),
    orderBy: [desc(campaigns.createdAt)],
    limit: 10,
    columns: {
      id: true, status: true, createdAt: true, failureReason: true, micrositeSlug: true, micrositePublished: true, micrositeViews: true,
      facebookPosts: true, instagramPosts: true, emailJustListed: true, emailStillAvailable: true, videoScript: true, analytics: true,
    },
    with: { listing: { columns: { address: true, city: true, state: true, price: true, bedrooms: true, bathrooms: true, sqft: true, photos: true } } },
  })
  const size = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v as object).length : v ? 1 : 0)
  const campaignViews = rows.map(c => ({
    id: c.id, status: c.status, createdAt: c.createdAt, failureReason: c.failureReason,
    micrositeSlug: c.micrositeSlug, micrositePublished: c.micrositePublished, micrositeViews: c.micrositeViews,
    listing: c.listing,
    content: {
      'Facebook posts': size(c.facebookPosts), 'Instagram posts': size(c.instagramPosts),
      'Just-listed email': c.emailJustListed ? 1 : 0, 'Still-available email': c.emailStillAvailable ? 1 : 0,
      'Video scripts': c.videoScript ? 1 : 0, 'Other modules (analytics JSON)': size(c.analytics),
    },
  }))
  return { ...detail, campaignViews }
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}


// ── Revenue (Stripe is the source of truth; the DB has no amounts) ─────────────────────────────

export interface RevenueOverview {
  ok: boolean
  /** Gross cash collected since the 1st of this month (UTC), from PAID invoices, before refunds/fees/tax adjustments. */
  mtdCents: number
  mtdInvoices: number
  /** Monthly recurring revenue: active + past_due subscriptions, annual plans / 12, list price × quantity, after percent/amount-off coupons. */
  mrrCents: number
  payingSubscriptions: number
  asOf: Date
}

/** Normalise one recurring price to cents per month. Pure — unit-tested. */
export function monthlyCents(unitAmountCents: number, interval: string, intervalCount = 1, quantity = 1): number {
  const n = Math.max(1, intervalCount)
  const perInterval = unitAmountCents * Math.max(0, quantity)
  switch (interval) {
    case 'month': return perInterval / n
    case 'year': return perInterval / (12 * n)
    case 'week': return (perInterval * 52) / (12 * n)
    case 'day': return (perInterval * 365) / (12 * n)
    default: return 0
  }
}

let revenueCache: { at: number; value: RevenueOverview } | null = null

/** Cached 60s so reloading the admin page does not hammer Stripe. Never throws: on failure returns ok:false (UI shows "—"). */
export async function getRevenueOverview(now = new Date()): Promise<RevenueOverview> {
  if (revenueCache && Date.now() - revenueCache.at < 60_000) return revenueCache.value
  const empty: RevenueOverview = { ok: false, mtdCents: 0, mtdInvoices: 0, mrrCents: 0, payingSubscriptions: 0, asOf: now }
  try {
    const monthStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000)
    let mtdCents = 0, mtdInvoices = 0, seen = 0
    for await (const inv of stripe.invoices.list({ status: 'paid', created: { gte: monthStart }, limit: 100 })) {
      mtdCents += inv.amount_paid ?? 0
      if ((inv.amount_paid ?? 0) > 0) mtdInvoices++
      if (++seen >= 5000) break
    }
    let mrr = 0, subs = 0
    for (const status of ['active', 'past_due'] as const) {
      let n = 0
      for await (const sub of stripe.subscriptions.list({ status, limit: 100, expand: ['data.discount.coupon'] })) {
        let monthly = 0
        for (const item of sub.items.data) {
          const p = item.price
          if (!p?.recurring || p.unit_amount == null) continue
          monthly += monthlyCents(p.unit_amount, p.recurring.interval, p.recurring.interval_count, item.quantity ?? 1)
        }
        const c = (sub as any).discount?.coupon
        if (c?.percent_off) monthly *= 1 - c.percent_off / 100
        else if (c?.amount_off && monthly > 0) monthly = Math.max(0, monthly - monthlyCents(c.amount_off, sub.items.data[0]?.price?.recurring?.interval ?? 'month', sub.items.data[0]?.price?.recurring?.interval_count ?? 1, 1))
        if (monthly > 0) { mrr += monthly; subs++ }
        if (++n >= 5000) break
      }
    }
    const value: RevenueOverview = { ok: true, mtdCents, mtdInvoices, mrrCents: Math.round(mrr), payingSubscriptions: subs, asOf: now }
    revenueCache = { at: Date.now(), value }
    return value
  } catch (err) {
    console.error('[admin] revenue overview failed:', err)
    return empty
  }
}
