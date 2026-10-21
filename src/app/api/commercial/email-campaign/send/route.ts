// src/app/api/commercial/email-campaign/send/route.ts
/**
 * Sends email #1 of an outreach sequence to a list of prospects.
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
import { siteReports } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { rateLimitEmailSend, rateLimitHeaders } from '@/lib/ratelimit'
import { sendEmail, postalAddress, oneLine } from '@/lib/email'
import { normalizeEmail } from '@/lib/unsubscribe'
import { assertAdult } from '@/lib/age'

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
      if (result.ok) sent++
      else if (result.reason === 'suppressed') suppressed++
      else failed++
    }

    return NextResponse.json({
      sent,
      skippedUnsubscribed: suppressed,
      failed,
      sequenceLength: sequence.length,
      // NOTE: follow-up emails (day 1+) are NOT scheduled automatically — only email #1 is sent here.
      message:
        `Email 1 sent to ${sent} prospect${sent !== 1 ? 's' : ''}` +
        (suppressed ? `; ${suppressed} skipped because they previously unsubscribed` : '') +
        (failed ? `; ${failed} failed to send` : '') +
        `. Follow-up emails in the sequence are not sent automatically yet.`,
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
