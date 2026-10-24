/**
 * GET /api/cron/retention — daily Vercel Cron enforcing the retention policy in lib/retention.ts.
 * Auth: "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends it automatically when CRON_SECRET is set).
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, isNotNull, lt, notLike } from 'drizzle-orm'
import { cronAuthorized } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { aiUsage, auditLogs, brandKits, campaigns, leadSettings, leads, listingUploads, listings, propertyGrades, siteReports, stripeEvents, users } from '@/lib/db/schema'
import { deleteFromR2 } from '@/lib/r2'
import { logAudit } from '@/lib/audit'
import { captureError } from '@/lib/monitoring'
import { handleApiError } from '@/lib/api-utils'
import { RETENTION, daysAgoDate, r2KeyFromUrl } from '@/lib/retention'

export const maxDuration = 120


/** Purge ONE closed account: delete its content + files, then anonymize the row (kept so billing/FK history stays valid). */
async function purgeUser(u: { id: string }) {
  const userListings = await db.select({ keys: listings.photoKeys }).from(listings).where(eq(listings.agentId, u.id))
  const kits = await db.select({ logo: brandKits.logoUrl, photo: brandKits.agentPhotoUrl, bLogo: brandKits.brokerageLogo }).from(brandKits).where(eq(brandKits.userId, u.id))
  const uploads = await db.select({ key: listingUploads.key }).from(listingUploads).where(eq(listingUploads.userId, u.id))

  const keys = new Set<string>([
    ...userListings.flatMap(l => l.keys ?? []),
    ...uploads.map(x => x.key),
    ...kits.flatMap(k => [k.logo, k.photo, k.bLogo]).map(x => r2KeyFromUrl(x)).filter((x): x is string => !!x),
  ])
  await Promise.all([...keys].map(k => deleteFromR2(k)))

  await db.delete(leads).where(eq(leads.agentId, u.id))
  await db.delete(leadSettings).where(eq(leadSettings.userId, u.id))
  await db.delete(campaigns).where(eq(campaigns.agentId, u.id))
  await db.delete(listings).where(eq(listings.agentId, u.id))
  await db.delete(listingUploads).where(eq(listingUploads.userId, u.id))
  await db.delete(propertyGrades).where(eq(propertyGrades.userId, u.id))
  await db.delete(siteReports).where(eq(siteReports.userId, u.id))
  await db.delete(brandKits).where(eq(brandKits.userId, u.id))

  await db.update(users).set({
    email: `deleted+${u.id}@deleted.invalid`, clerkId: `deleted:${u.id}`,
    firstName: null, lastName: null, phone: null, avatarUrl: null, mlsAgentId: null, aiPersona: null, referralCode: null,
  }).where(eq(users.id, u.id))
  await logAudit({ action: 'user.deleted', actorClerkId: 'system:retention', targetUserId: u.id, metadata: { step: 'purged', filesDeleted: keys.size } })
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = { usersPurged: 0, usersFailed: 0, failedCampaignsDeleted: 0 }

    // 1. closed accounts past the grace period (max 10 per run keeps the job short; the rest follow tomorrow)
    const due = await db.select({ id: users.id }).from(users)
      .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, daysAgoDate(RETENTION.closedAccountDays)), notLike(users.clerkId, 'deleted:%')))
      .limit(10)
    for (const u of due) {
      try { await purgeUser(u); result.usersPurged++ }
      catch (err) { result.usersFailed++; captureError(err, { context: 'retention_purge_user', userId: u.id }) }
    }

    // 2. old failed campaigns (no useful content)
    const failed = await db.delete(campaigns)
      .where(and(eq(campaigns.status, 'failed'), lt(campaigns.createdAt, daysAgoDate(RETENTION.failedCampaignDays))))
      .returning({ id: campaigns.id })
    result.failedCampaignsDeleted = failed.length

    // 3. ledgers
    await db.delete(aiUsage).where(lt(aiUsage.createdAt, daysAgoDate(RETENTION.aiUsageDays)))
    await db.delete(auditLogs).where(lt(auditLogs.createdAt, daysAgoDate(RETENTION.auditLogDays)))
    await db.delete(stripeEvents).where(lt(stripeEvents.createdAt, daysAgoDate(RETENTION.stripeEventDays)))

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return handleApiError(err, { route: 'cron/retention' })
  }
}
