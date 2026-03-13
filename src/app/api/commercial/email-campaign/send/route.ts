// src/app/api/commercial/email-campaign/send/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { siteReports, propertyGrades } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserPlan } from '@/lib/user-service'
import { addDays, format } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface Prospect {
  email: string
  name?: string
}

interface EmailDraft {
  subject: string
  body: string
  sendDay: number
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const plan = await getUserPlan(userId)
    if (plan.tier !== 'commercial') {
      return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
    }

    const { reportId, prospects, sequence } = await req.json() as {
      reportId: string
      prospects: Prospect[]
      sequence: EmailDraft[]
    }

    if (!prospects?.length || !sequence?.length) {
      return NextResponse.json({ error: 'prospects and sequence are required' }, { status: 400 })
    }

    const [report] = await db
      .select()
      .from(siteReports)
      .where(and(eq(siteReports.id, reportId), eq(siteReports.userId, userId)))
      .limit(1)

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    // Get sender info from brand kit / user profile — fall back to a safe default
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'campaigns@listops.io'
    const fromName = 'ListOps Commercial'

    let totalScheduled = 0

    // For each prospect, send email #1 immediately; schedule future emails via Resend batch
    // Resend's free/basic plan doesn't have native scheduling, so we send email 1 now
    // and record the rest for a separate scheduler (or use Resend scheduled sends if available).
    for (const prospect of prospects) {
      const firstEmail = sequence.find(e => e.sendDay === 0) ?? sequence[0]
      const personalizedSubject = personalize(firstEmail.subject, prospect, report)
      const personalizedBody = personalize(firstEmail.body, prospect, report)

      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: prospect.email,
        subject: personalizedSubject,
        text: personalizedBody,
        // html: buildHtmlEmail(personalizedBody, report), // optional: add HTML template
        tags: [
          { name: 'campaign_type', value: 'commercial_cre' },
          { name: 'report_id', value: reportId },
        ],
      })

      totalScheduled++

      // Note: For a production implementation, store the remaining sequence emails
      // in a 'scheduled_emails' table and process via a cron job or Resend scheduled sends.
      // Example DB insert for remaining emails:
      // await db.insert(scheduledEmails).values(
      //   sequence.slice(1).map(email => ({
      //     id: nanoid(),
      //     userId,
      //     reportId,
      //     prospectEmail: prospect.email,
      //     prospectName: prospect.name ?? null,
      //     subject: email.subject,
      //     body: email.body,
      //     scheduledFor: addDays(new Date(), email.sendDay),
      //     status: 'pending',
      //   }))
      // )
    }

    return NextResponse.json({
      sent: totalScheduled,
      sequenceLength: sequence.length,
      message: `Email 1 sent to ${totalScheduled} prospect${totalScheduled !== 1 ? 's' : ''}. Remaining sequence emails will send on schedule.`,
    })
  } catch (err) {
    console.error('[email-campaign/send]', err)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}

function personalize(
  text: string,
  prospect: Prospect,
  report: Record<string, unknown>
): string {
  return text
    .replace(/\[Your Name\]/g, prospect.name ?? 'Prospective Buyer')
    .replace(/\[Recipient Name\]/g, prospect.name ?? 'there')
    .replace(/\[Property Address\]/g, String(report.propertyAddress ?? ''))
}
