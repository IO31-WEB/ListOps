/**
 * Referral commissions: simple tracking + manual payout.
 *
 *  accrual   Stripe `invoice.payment_succeeded` for a customer who signed up through a referral LINK → one row per paid invoice
 *            (UNIQUE on the Stripe invoice id, so webhook retries are harmless). Seat invitees never earn commission.
 *  hold      a row is payable only after `eligible_at` (default 30 days after the payment) so refunds/chargebacks can land first.
 *  payout    the admin pays the referrer outside the app (PayPal / Zelle / ACH) and clicks "Mark paid" — all payable rows for
 *            that referrer flip to `paid` atomically, with method + reference + who did it (and an audit-log entry).
 *  refunds   `charge.refunded` voids unpaid rows; rows already paid become `clawback` so the admin sees what to recover/offset.
 *
 * PRODUCT DECISIONS (env-tunable): REFERRAL_COMMISSION_PCT (default 20), REFERRAL_HOLD_DAYS (30), REFERRAL_MAX_PAID_INVOICES (12 per referral).
 */
import { and, eq, inArray, lte, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { referralCommissions, referrals, users } from '@/lib/db/schema'

const num = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : d
}
export const commissionPct = () => num(process.env.REFERRAL_COMMISSION_PCT, 20, 0, 100)
export const holdDays = () => Math.floor(num(process.env.REFERRAL_HOLD_DAYS, 30, 0, 365))
export const maxPaidInvoices = () => Math.floor(num(process.env.REFERRAL_MAX_PAID_INVOICES, 12, 1, 120))

/** Whole cents, rounded DOWN so we never over-accrue. rateBps = percent × 100. */
export function commissionCents(amountPaidCents: number, rateBps: number): number {
  if (!Number.isFinite(amountPaidCents) || amountPaidCents <= 0 || rateBps <= 0) return 0
  return Math.floor((amountPaidCents * rateBps) / 10_000)
}

export const fmtUsd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000)

/** Called from the Stripe webhook after a paid invoice. Returns the commission row id, or null when nothing is owed. */
export async function recordCommissionForInvoice(opts: {
  orgId: string; invoiceId: string; amountPaidCents: number; now?: Date
}): Promise<string | null> {
  const now = opts.now ?? new Date()
  if (!opts.invoiceId || opts.amountPaidCents <= 0) return null // $0 trial invoices earn nothing

  const owners = await db.select({ id: users.id }).from(users).where(and(eq(users.orgId, opts.orgId), eq(users.role, 'owner')))
  if (!owners.length) return null

  const ref = await db.query.referrals.findFirst({
    where: and(inArray(referrals.referredUserId, owners.map(o => o.id)), eq(referrals.source, 'link')),
  })
  if (!ref || !ref.referredUserId || ref.referrerId === ref.referredUserId) return null // no referrer / self-referral

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(referralCommissions)
    .where(and(eq(referralCommissions.referralId, ref.id), ne(referralCommissions.status, 'void')))
  if (n >= maxPaidInvoices()) return null

  const rateBps = Math.round(commissionPct() * 100)
  const cents = commissionCents(opts.amountPaidCents, rateBps)
  if (cents <= 0) return null

  const rows = await db.insert(referralCommissions).values({
    referralId: ref.id, referrerId: ref.referrerId, referredUserId: ref.referredUserId,
    stripeInvoiceId: opts.invoiceId, amountPaidCents: opts.amountPaidCents, commissionCents: cents, rateBps,
    eligibleAt: addDays(now, holdDays()),
  }).onConflictDoNothing({ target: referralCommissions.stripeInvoiceId }).returning({ id: referralCommissions.id })
  return rows[0]?.id ?? null
}

/** Stripe refunded the invoice's charge: unpaid commission is voided; an already-paid one is flagged for recovery. */
export async function reverseCommissionForInvoice(invoiceId: string): Promise<{ voided: number; clawback: number }> {
  if (!invoiceId) return { voided: 0, clawback: 0 }
  const voided = await db.update(referralCommissions).set({ status: 'void' })
    .where(and(eq(referralCommissions.stripeInvoiceId, invoiceId), eq(referralCommissions.status, 'pending')))
    .returning({ id: referralCommissions.id })
  const claw = await db.update(referralCommissions).set({ status: 'clawback' })
    .where(and(eq(referralCommissions.stripeInvoiceId, invoiceId), eq(referralCommissions.status, 'paid')))
    .returning({ id: referralCommissions.id })
  return { voided: voided.length, clawback: claw.length }
}

export interface EarningsTotals { holdCents: number; payableCents: number; paidCents: number; clawbackCents: number }

/** Totals for a set of rows. A pending row is "on hold" until eligible_at, then "payable". */
export function totalsOf(rows: Array<{ status: string; commissionCents: number; eligibleAt: Date }>, now = new Date()): EarningsTotals {
  const t: EarningsTotals = { holdCents: 0, payableCents: 0, paidCents: 0, clawbackCents: 0 }
  for (const r of rows) {
    if (r.status === 'paid') t.paidCents += r.commissionCents
    else if (r.status === 'clawback') t.clawbackCents += r.commissionCents
    else if (r.status === 'pending') (r.eligibleAt <= now ? (t.payableCents += r.commissionCents) : (t.holdCents += r.commissionCents))
  }
  return t
}

export async function getMyEarnings(userId: string, now = new Date()) {
  const rows = await db.select().from(referralCommissions).where(eq(referralCommissions.referrerId, userId))
  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { payoutEmail: true } })
  return { ...totalsOf(rows, now), payoutEmail: me?.payoutEmail ?? null, ratePct: commissionPct(), holdDays: holdDays() }
}

export interface ReferrerSummary extends EarningsTotals {
  referrerId: string; name: string; email: string; payoutEmail: string | null
  referredCount: number; payingCount: number; lastPaidAt: Date | null
}

/** Admin: one row per referrer who has referred anyone. Sorted by what is payable now. */
export async function getReferrerSummaries(now = new Date()): Promise<ReferrerSummary[]> {
  const [refRows, comRows] = await Promise.all([
    db.select({ referrerId: referrals.referrerId, status: referrals.status }).from(referrals).where(eq(referrals.source, 'link')),
    db.select().from(referralCommissions),
  ])
  const ids = [...new Set([...refRows.map(r => r.referrerId), ...comRows.map(c => c.referrerId)])]
  if (!ids.length) return []
  const people = await db.select({ id: users.id, name: users.name, email: users.email, payoutEmail: users.payoutEmail }).from(users).where(inArray(users.id, ids))
  const byId = new Map(people.map(p => [p.id, p]))
  const out = ids.map((id): ReferrerSummary => {
    const mine = comRows.filter(c => c.referrerId === id)
    const p = byId.get(id)
    return {
      referrerId: id, name: p?.name ?? '', email: p?.email ?? '', payoutEmail: p?.payoutEmail ?? null,
      referredCount: refRows.filter(r => r.referrerId === id).length,
      payingCount: new Set(mine.filter(c => c.status !== 'void').map(c => c.referredUserId)).size,
      lastPaidAt: mine.reduce<Date | null>((a, c) => (c.paidAt && (!a || c.paidAt > a) ? c.paidAt : a), null),
      ...totalsOf(mine, now),
    }
  })
  return out.sort((a, b) => b.payableCents - a.payableCents || b.holdCents - a.holdCents || b.paidCents - a.paidCents)
}

/** Admin: pay out everything that is payable for one referrer. Atomic — a double click cannot pay twice. */
export async function markCommissionsPaid(opts: {
  referrerId: string; method: string; reference: string; paidBy: string; now?: Date
}): Promise<{ count: number; totalCents: number }> {
  const now = opts.now ?? new Date()
  const rows = await db.update(referralCommissions)
    .set({ status: 'paid', paidAt: now, paidMethod: opts.method, paidReference: opts.reference, paidBy: opts.paidBy })
    .where(and(eq(referralCommissions.referrerId, opts.referrerId), eq(referralCommissions.status, 'pending'), lte(referralCommissions.eligibleAt, now)))
    .returning({ cents: referralCommissions.commissionCents })
  return { count: rows.length, totalCents: rows.reduce((s, r) => s + r.cents, 0) }
}
