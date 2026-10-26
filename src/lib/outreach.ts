/**
 * Sends scheduled outreach follow-ups (emails 2..N of a sequence). Called by the daily cron.
 *
 * Safety rules, enforced here at SEND time (not just when scheduling):
 *  - every email goes through sendEmail({kind:'marketing'}) -> unsubscribe link, postal address, suppression check
 *  - recipients who unsubscribed since email #1 are skipped
 *  - the sender's account must still be active (not closed/blocked/age-unconfirmed) and still on a plan that allows outreach
 *  - each row is atomically claimed (pending -> sending) so overlapping cron runs can never send the same email twice
 *  - failures retry on later runs, max 3 attempts, then are marked failed
 */
import { and, asc, eq, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { outreachEmails, users } from '@/lib/db/schema'
import { sendEmail } from '@/lib/email'
import { canAccess } from '@/lib/plans'
import type { PlanTier } from '@/lib/plans'
import { planOf } from '@/lib/admin-data'
import { captureError } from '@/lib/monitoring'

type Sender = { ok: boolean; name: string; email: string }
const MAX_ATTEMPTS = 3

export async function processDueOutreach(opts: { limit?: number; deadlineMs?: number } = {}) {
  const limit = opts.limit ?? 200
  const deadline = Date.now() + (opts.deadlineMs ?? 45_000)
  const out = { due: 0, sent: 0, skipped: 0, retry: 0, failed: 0, stoppedEarly: false }

  const due = await db.select().from(outreachEmails)
    .where(and(eq(outreachEmails.status, 'pending'), lte(outreachEmails.sendAt, new Date())))
    .orderBy(asc(outreachEmails.sendAt)).limit(limit)
  out.due = due.length

  const senders = new Map<string, Sender>()
  const getSender = async (userId: string): Promise<Sender> => {
    const cached = senders.get(userId)
    if (cached) return cached
    const u = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { organization: { with: { subscriptions: true } } },
    })
    const eligible =
      !!u && !u.deletedAt && !u.ageBlockedAt && !!u.ageConfirmedAt &&
      canAccess(planOf(u) as PlanTier, 'outreach_send')
    const s: Sender = {
      ok: eligible,
      name: [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'A ListOps user',
      email: u?.email ?? '',
    }
    senders.set(userId, s)
    return s
  }

  for (const row of due) {
    if (Date.now() > deadline) { out.stoppedEarly = true; break }

    // Atomic claim: only one runner can move a row pending -> sending.
    const claimed = await db.update(outreachEmails)
      .set({ status: 'sending', attempts: row.attempts + 1 })
      .where(and(eq(outreachEmails.id, row.id), eq(outreachEmails.status, 'pending')))
      .returning({ id: outreachEmails.id })
    if (claimed.length === 0) continue

    const sender = await getSender(row.userId)
    if (!sender.ok) {
      await db.update(outreachEmails).set({ status: 'skipped', skipReason: 'sender no longer eligible' }).where(eq(outreachEmails.id, row.id))
      out.skipped++
      continue
    }

    const result = await sendEmail({
      kind: 'marketing',
      to: row.recipientEmail,
      fromName: `${sender.name} via ListOps`,
      replyTo: sender.email,
      subject: row.subject,
      text: row.body,
      reason: `You are receiving this email because ${sender.name} contacted you about a commercial property.`,
      tags: [{ name: 'campaign_type', value: 'commercial_cre_followup' }],
    })

    if (result.ok) {
      await db.update(outreachEmails).set({ status: 'sent', sentAt: new Date() }).where(eq(outreachEmails.id, row.id))
      out.sent++
    } else if (result.reason === 'suppressed') {
      await db.update(outreachEmails).set({ status: 'skipped', skipReason: 'unsubscribed' }).where(eq(outreachEmails.id, row.id))
      out.skipped++
    } else if (result.reason === 'no_postal_address' || result.reason === 'not_configured') {
      // Our misconfiguration, not the recipient's problem: put it back untouched and stop (don't burn attempts).
      await db.update(outreachEmails).set({ status: 'pending', attempts: row.attempts }).where(eq(outreachEmails.id, row.id))
      captureError(new Error(`Outreach follow-ups paused: ${result.reason}`), {})
      out.stoppedEarly = true
      break
    } else if (row.attempts + 1 >= MAX_ATTEMPTS) {
      await db.update(outreachEmails).set({ status: 'failed', skipReason: 'provider error' }).where(eq(outreachEmails.id, row.id))
      out.failed++
    } else {
      await db.update(outreachEmails).set({ status: 'pending' }).where(eq(outreachEmails.id, row.id))
      out.retry++
    }
  }
  return out
}
