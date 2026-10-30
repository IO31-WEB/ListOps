import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin'
import { commissionPct, fmtUsd, getReferrerSummaries, holdDays, maxPaidInvoices } from '@/lib/referral-commissions'
import { Card, DesktopTable, KV, MobileItem, MobileList, Stat, fmtDate, th, td } from '../_lib'
import { PayForm } from './pay-form'

export const dynamic = 'force-dynamic'

export default async function AdminReferrals() {
  await requireAdminPage()
  const rows = await getReferrerSummaries()
  const sum = rows.reduce((a, r) => ({ payable: a.payable + r.payableCents, hold: a.hold + r.holdCents, paid: a.paid + r.paidCents, claw: a.claw + r.clawbackCents }), { payable: 0, hold: 0, paid: 0, claw: 0 })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Payable now" value={fmtUsd(sum.payable)} sub="past the hold period" />
        <Stat label="On hold" value={fmtUsd(sum.hold)} sub={`${holdDays()}-day hold after each payment`} />
        <Stat label="Paid out (all time)" value={fmtUsd(sum.paid)} />
        <Stat label="To recover" value={fmtUsd(sum.claw)} sub="paid, then the invoice was refunded" />
      </div>

      <Card title="Referrers">
        <p className="text-xs text-slate-500 mb-3">
          Commission: {commissionPct()}% of each paid invoice from a referred customer, up to {maxPaidInvoices()} payments per referral. Pay referrers manually (PayPal, Zelle, …) then click <b>Mark paid</b>;
          it records who paid what, when, and the reference. <a className="underline" href="/api/admin/referrals/export">Export CSV</a>
        </p>
        {rows.length === 0 ? <p className="text-sm text-slate-500">No referrals yet.</p> : (
          <>
            <DesktopTable>
              <thead><tr><th className={th}>Referrer</th><th className={th}>Payout email</th><th className={th}>Referred</th><th className={th}>Paying</th><th className={th}>Payable</th><th className={th}>On hold</th><th className={th}>Paid</th><th className={th}>To recover</th><th className={th}>Action</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.referrerId} className="align-top">
                    <td className={td}><Link className="text-amber-700 underline" href={`/admin/users/${r.referrerId}`}>{r.name || r.email}</Link><div className="text-xs text-slate-500">{r.email}</div></td>
                    <td className={td}>{r.payoutEmail ?? <span className="text-red-700">not set</span>}</td>
                    <td className={td}>{r.referredCount}</td><td className={td}>{r.payingCount}</td>
                    <td className={`${td} font-semibold`}>{fmtUsd(r.payableCents)}</td><td className={td}>{fmtUsd(r.holdCents)}</td>
                    <td className={td}>{fmtUsd(r.paidCents)}<div className="text-xs text-slate-500">{r.lastPaidAt ? fmtDate(r.lastPaidAt) : ''}</div></td>
                    <td className={td}>{r.clawbackCents ? <span className="text-red-700">{fmtUsd(r.clawbackCents)}</span> : '—'}</td>
                    <td className={td}>{r.payableCents > 0 ? <PayForm referrerId={r.referrerId} payableLabel={fmtUsd(r.payableCents)} payoutEmail={r.payoutEmail} /> : <span className="text-xs text-slate-400">nothing payable</span>}</td>
                  </tr>
                ))}
              </tbody>
            </DesktopTable>
            <MobileList>
              {rows.map(r => (
                <MobileItem key={r.referrerId}>
                  <KV label="Referrer"><Link className="text-amber-700 underline" href={`/admin/users/${r.referrerId}`}>{r.name || r.email}</Link></KV>
                  <KV label="Payout">{r.payoutEmail ?? <span className="text-red-700">not set</span>}</KV>
                  <KV label="Referred">{r.referredCount} · {r.payingCount} paying</KV>
                  <KV label="Payable"><b>{fmtUsd(r.payableCents)}</b> · hold {fmtUsd(r.holdCents)}</KV>
                  <KV label="Paid">{fmtUsd(r.paidCents)}{r.clawbackCents ? <span className="text-red-700"> · recover {fmtUsd(r.clawbackCents)}</span> : null}</KV>
                  {r.payableCents > 0 && <div className="pt-1"><PayForm referrerId={r.referrerId} payableLabel={fmtUsd(r.payableCents)} payoutEmail={r.payoutEmail} /></div>}
                </MobileItem>
              ))}
            </MobileList>
          </>
        )}
      </Card>
    </div>
  )
}
