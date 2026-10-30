/** GET /api/admin/referrals/export — CSV of every commission row (for the books / 1099 prep). Admin only. */
import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { referralCommissions, users } from '@/lib/db/schema'
import { handleApiError } from '@/lib/api-utils'
import { requireAdminApi } from '@/lib/admin'

// Neutralise spreadsheet formula injection (=, +, -, @) in any user-controlled text.
const cell = (v: unknown) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET() {
  try {
    await requireAdminApi()
    const rows = await db.select({
      id: referralCommissions.id, createdAt: referralCommissions.createdAt, status: referralCommissions.status,
      referrerEmail: users.email, payoutEmail: users.payoutEmail, invoice: referralCommissions.stripeInvoiceId,
      paidCents: referralCommissions.amountPaidCents, commissionCents: referralCommissions.commissionCents, rateBps: referralCommissions.rateBps,
      eligibleAt: referralCommissions.eligibleAt, paidAt: referralCommissions.paidAt, method: referralCommissions.paidMethod, reference: referralCommissions.paidReference,
    }).from(referralCommissions).innerJoin(users, eq(users.id, referralCommissions.referrerId)).orderBy(desc(referralCommissions.createdAt)).limit(20_000)
    const head = ['created_at', 'status', 'referrer_email', 'payout_email', 'stripe_invoice', 'invoice_amount_usd', 'commission_usd', 'rate_pct', 'eligible_at', 'paid_at', 'method', 'reference']
    const lines = [head.join(',')].concat(rows.map(r => [
      r.createdAt, r.status, r.referrerEmail, r.payoutEmail, r.invoice, (r.paidCents / 100).toFixed(2), (r.commissionCents / 100).toFixed(2), r.rateBps / 100,
      r.eligibleAt, r.paidAt, r.method, r.reference,
    ].map(cell).join(',')))
    return new NextResponse(lines.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="referral-commissions.csv"', 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleApiError(err, { route: 'admin/referrals.export' })
  }
}
