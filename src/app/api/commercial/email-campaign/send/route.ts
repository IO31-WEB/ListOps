// src/app/api/commercial/email-campaign/send/route.ts
/**
 * Sends email #1 of an outreach sequence to a list of prospects NOW, and schedules emails 2..N (sent by the daily cron,
 * see lib/outreach.ts). GET = status counts for a report, DELETE = cancel pending follow-ups.
 *
 * Compliance + abuse controls (all enforced server-side):
 *  - every message goes through sendEmail({ kind: 'marketing' }), which REFUSES to send without a postal
 *    address, skips suppressed (unsubscribed) recipients, and adds a working one-click unsubscribe link
 *  - replies go to the sending agent, and the From name identifies them (no deceptive headers)
 *  - strict validation, max 100 recipients per request, de-duplication, 10 batches/day/user
 */
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { outreachEmails, siteReports, users } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { rateLimitEmailSend, rateLimitHeaders } from '@/lib/ratelimit'
import { sendEmail, postalAddress, oneLine } from '@/lib/email'
import { normalizeEmail } from '@/lib/unsubscribe'
import { assertAdult } from '@/lib/age'
import { logAudit } from '@/lib/audit'
import { randomUUID } from 'crypto'

const BodySchema = z.object({
  reportId: z.string().uuid(),
  prospects: z.array(z.object({
    email: z.string().trim().email().max(254),
    name: z.string().transform(s => oneLine(s, 100)).optional(),
  })).min(1).max(100),
  sequence: z.array(z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(8000),
    sendDay: z.number().int().min(0).max(365),
  })).min(1).max(10),
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError(401, 'Unauthorized')

    // Refuse early (before any work) if we cannot send compliant mail.
    if (!process.env.RESEND_API_KEY || !postalAddress() || !process.env.UNSUBSCRIBE_SECRET) {
      console.error('[email-campaign/send] missing RESEND_API_KEY / MAIL_FOOTER_ADDRESS / UNSUBSCRIBE_SECRET')
      throw new ApiError(503, 'Email sending is not available right now.')
    }

    const rl = await rateLimitEmailSend(userId)
    if (!rl.success) throw new ApiError(429, 'Daily email send limit reached. Please try again tomorrow.', rateLimitHeaders(rl))

    const dbUser = await getUserWithDetails(userId)
    if (!dbUser?.organization) throw new ApiError(404, 'Organization not found')
    assertAdult(dbUser)

    const sub = dbUser.organization.subscriptions?.[0]
    const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
    if (!canAccess(plan, 'site_analysis')) throw new ApiError(403, 'Commercial plan required')

    const { reportId, prospects, sequence } = BodySchema.parse(await readJson(req, 256 * 1024))

    const [report] = await db
      .select()
      .from(siteReports)
      .where(and(eq(siteReports.id, reportId), eq(siteReports.userId, dbUser.id)))
      .limit(1)
    if (!report) throw new ApiError(404, 'Report not found')

    const senderName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ') || 'A ListOps user'
    const firstEmail = sequence.find(e => e.sendDay === 0) ?? sequence[0]

    // de-duplicate recipients (case-insensitive)
    const seen = new Set<string>()
    const unique = prospects.filter(p => {
      const k = normalizeEmail(p.email)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    const batchId = randomUUID()
    const now = Date.now()
    const followUps = sequence.filter(e => e !== firstEmail)
    const scheduleRows: Array<typeof outreachEmails.$inferInsert> = []

    let sent = 0, suppressed = 0, failed = 0
    for (const prospect of unique) {
      const result = await sendEmail({
        kind: 'marketing',
        to: prospect.email,
        fromName: `${senderName} via ListOps`,
        replyTo: dbUser.email, // replies go to the agent, not to ListOps
        subject: personalize(firstEmail.subject, prospect, report),
        text: personalize(firstEmail.body, prospect, report),
        reason: `You are receiving this email because ${senderName} contacted you about a commercial property.`,
        tags: [
          { name: 'campaign_type', value: 'commercial_cre' },
          { name: 'report_id', value: reportId },
        ],
      })
      if (result.ok) {
        sent++
        // Email #1 went out -> schedule the rest of the sequence for this prospect (sent by the daily cron).
        followUps.forEach(step => {
          scheduleRows.push({
            userId: dbUser.id, reportId, batchId, recipientEmail: normalizeEmail(prospect.email), recipientName: prospect.name ?? null,
            stepIndex: sequence.indexOf(step),
            subject: personalize(step.subject, prospect, report), body: personalize(step.body, prospect, report),
            sendAt: new Date(now + Math.max(1, step.sendDay) * 24 * 60 * 60 * 1000),
          })
        })
      }
      else if (result.reason === 'suppressed') suppressed++
      else failed++
    }

    for (let i = 0; i < scheduleRows.length; i += 200) {
      await db.insert(outreachEmails).values(scheduleRows.slice(i, i + 200)).onConflictDoNothing()
    }

    await logAudit({ action: 'outreach.batch_sent', actorClerkId: userId, targetUserId: dbUser.id, resourceType: 'site_report', request: req, metadata: { reportId, recipients: unique.length, sent, suppressed, failed, scheduledFollowUps: scheduleRows.length } })
    return NextResponse.json({
      sent,
      skippedUnsubscribed: suppressed,
      failed,
      sequenceLength: sequence.length,
      scheduledFollowUps: scheduleRows.length,
      message:
        `Email 1 sent to ${sent} prospect${sent !== 1 ? 's' : ''}` +
        (suppressed ? `; ${suppressed} skipped because they previously unsubscribed` : '') +
        (failed ? `; ${failed} failed to send` : '') +
        (scheduleRows.length
          ? `. ${scheduleRows.length} follow-up email${scheduleRows.length !== 1 ? 's are' : ' is'} scheduled and will send automatically (once a day, around 9–10 am US Eastern). Anyone who unsubscribes is skipped, and you can cancel the follow-ups at any time.`
          : '.'),
    })
  } catch (err) {
    return handleApiError(err, { route: 'email-campaign/send' })
  }
}

function personalize(
  text: string,
  prospect: { email: string; name?: string },
  report: Record<string, unknown>
): string {
  return text
    .replace(/\[Your Name\]/g, prospect.name ?? 'Prospective Buyer')
    .replace(/\[Recipient Name\]/g, prospect.name ?? 'there')
    .replace(/\[Property Address\]/g, String(report.propertyAddress ?? ''))
}

const ReportQuery = z.object({ reportId: z.string().uuid(), email: z.string().trim().toLowerCase().email().optional() })

async function currentDbUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new ApiError(401, 'Unauthorized')
  const u = await db.query.users.findFirst({ where: eq(users.clerkId, userId), columns: { id: true } })
  if (!u) throw new ApiError(404, 'Account not found')
  return u.id
}

/** GET ?reportId= -> how many follow-ups are pending / sent / skipped / cancelled for this report (own rows only). */
export async function GET(req: NextRequest) {
  try {
    const dbUserId = await currentDbUserId()
    const { reportId } = ReportQuery.parse(Object.fromEntries(new URL(req.url).searchParams))
    const rows = await db.select({ status: outreachEmails.status, n: count() }).from(outreachEmails)
      .where(and(eq(outreachEmails.userId, dbUserId), eq(outreachEmails.reportId, reportId)))
      .groupBy(outreachEmails.status)
    const counts: Record<string, number> = {}
    rows.forEach(r => { counts[r.status] = Number(r.n) })
    return NextResponse.json({ counts })
  } catch (err) {
    return handleApiError(err, { route: 'email-campaign/send GET' })
  }
}

/** DELETE ?reportId=[&email=] -> cancel all PENDING follow-ups for the report (or just one recipient, e.g. someone who replied). */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    const dbUserId = await currentDbUserId()
    const { reportId, email } = ReportQuery.parse(Object.fromEntries(new URL(req.url).searchParams))
    const cancelled = await db.update(outreachEmails).set({ status: 'cancelled', skipReason: 'cancelled by sender' })
      .where(and(
        eq(outreachEmails.userId, dbUserId), eq(outreachEmails.reportId, reportId), eq(outreachEmails.status, 'pending'),
        ...(email ? [eq(outreachEmails.recipientEmail, normalizeEmail(email))] : []),
      ))
      .returning({ id: outreachEmails.id })
    await logAudit({ action: 'outreach.cancelled', actorClerkId: userId!, targetUserId: dbUserId, resourceType: 'site_report', request: req, metadata: { reportId, cancelled: cancelled.length, singleRecipient: !!email } })
    return NextResponse.json({ cancelled: cancelled.length })
  } catch (err) {
    return handleApiError(err, { route: 'email-campaign/send DELETE' })
  }
}
