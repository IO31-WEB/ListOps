/**
 * Brokerage / team features: per-agent analytics, team activity log, campaign CSV export.
 * ACCESS RULE (enforced by getTeamAdminContext, used by every page and route that touches this data):
 *   plan has the 'analytics' feature (Brokerage / Enterprise)  AND  the signed-in user is the org's owner or admin.
 * Everything is scoped by org id taken from the SIGNED-IN user's own record — never from the request.
 */
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { auditLogs, campaigns, listings, users } from '@/lib/db/schema'
import { canAccess } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'
import { planOf } from '@/lib/admin-data'

export interface TeamAdminContext { orgId: string; userDbId: string; clerkId: string; plan: PlanTier; role: string }

/** Returns the context if the caller may use team features, otherwise null. */
export async function getTeamAdminContext(): Promise<TeamAdminContext | null> {
  const { userId } = await auth()
  if (!userId) return null
  const u = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { id: true, orgId: true, role: true, deletedAt: true },
    with: { organization: { with: { subscriptions: true } } },
  })
  if (!u || u.deletedAt || !u.orgId) return null
  const plan = planOf(u) as PlanTier
  if (!canAccess(plan, 'analytics')) return null
  if (u.role !== 'owner' && u.role !== 'admin') return null
  return { orgId: u.orgId, userDbId: u.id, clerkId: userId, plan, role: u.role }
}

export async function getOrgAgentStats(orgId: string) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const rows = await db
    .select({
      id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role,
      total: sql<number>`count(${campaigns.id})`,
      last30: sql<number>`count(${campaigns.id}) filter (where ${campaigns.createdAt} >= ${cutoff})`,
      failed30: sql<number>`count(${campaigns.id}) filter (where ${campaigns.status} = 'failed' and ${campaigns.createdAt} >= ${cutoff})`,
      views: sql<number>`coalesce(sum(${campaigns.micrositeViews}), 0)`,
      lastAt: sql<string | null>`max(${campaigns.createdAt})`,
    })
    .from(users)
    .leftJoin(campaigns, eq(campaigns.agentId, users.id))
    .where(and(eq(users.orgId, orgId), isNull(users.deletedAt)))
    .groupBy(users.id)
    .orderBy(desc(sql`count(${campaigns.id})`))
  return rows.map(r => ({ ...r, total: Number(r.total), last30: Number(r.last30), failed30: Number(r.failed30), views: Number(r.views) }))
}

export async function getOrgActivity(orgId: string, limit = 150) {
  return db
    .select({
      id: auditLogs.id, action: auditLogs.action, at: auditLogs.createdAt, metadata: auditLogs.metadata,
      actorEmail: users.email, actorFirst: users.firstName, actorLast: users.lastName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(eq(auditLogs.orgId, orgId), sql`${auditLogs.action} not like 'admin.%'`)) // internal staff actions aren't the customer's log
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
}

export async function getOrgCampaignExportRows(orgId: string, max = 5000) {
  return db
    .select({
      createdAt: campaigns.createdAt, status: campaigns.status, agentEmail: users.email,
      address: listings.address, city: listings.city, state: listings.state, price: listings.price,
      micrositeSlug: campaigns.micrositeSlug, micrositePublished: campaigns.micrositePublished, views: campaigns.micrositeViews,
    })
    .from(campaigns)
    .innerJoin(users, eq(campaigns.agentId, users.id))
    .leftJoin(listings, eq(campaigns.listingId, listings.id))
    .where(eq(users.orgId, orgId))
    .orderBy(desc(campaigns.createdAt))
    .limit(max)
}

/** CSV cell escaping + spreadsheet-formula-injection guard (cells starting with = + - @ are prefixed with an apostrophe). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const ACTION_LABELS: Record<string, string> = {
  'user.age_confirmed': 'Confirmed age & accepted Terms', 'user.age_blocked': 'Account closed (under 18)', 'user.deleted': 'Account closed',
  'listing.deleted': 'Deleted a listing', 'billing.checkout_started': 'Started a plan checkout', 'team.invite_sent': 'Invited a team member',
  'outreach.batch_sent': 'Sent an outreach batch', 'outreach.cancelled': 'Cancelled scheduled follow-ups',
}
