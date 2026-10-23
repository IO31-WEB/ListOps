import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin'
import { countFailures, getOverviewCounts, getRecentFailures, getSpendOverview } from '@/lib/admin-data'
import { Badge, Card, Stat, fmtDate, td, th, usd } from './_lib'

export const dynamic = 'force-dynamic'

export default async function AdminOverview() {
  await requireAdminPage()
  const [spend, counts, fail24, fail7, failures] = await Promise.all([
    getSpendOverview(), getOverviewCounts(), countFailures(1), countFailures(7), getRecentFailures(8, 7),
  ])
  const dailyCap = Number(process.env.AI_DAILY_BUDGET_USD) || 40
  const monthlyCap = Number(process.env.AI_MONTHLY_BUDGET_USD) || 400

  return (
    <div className="space-y-6">
      <form action="/admin/users" className="flex gap-2">
        <input name="q" placeholder="Look up a user by email, name, user id…" className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm" autoFocus />
        <button className="rounded-lg bg-slate-900 px-5 text-sm font-medium text-white">Search</button>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="AI spend today (est.)" value={usd(spend.today.cost)} sub={`${spend.today.calls} calls · cap ${usd(dailyCap)}`} />
        <Stat label="AI spend this month (est.)" value={usd(spend.month.cost)} sub={`${spend.month.calls} calls · cap ${usd(monthlyCap)}`} />
        <Stat label="Failed generations" value={fail24} sub={`last 24h · ${fail7} in 7 days`} />
        <Stat label="Users" value={counts.totalUsers} sub={`${counts.newUsers7d} new in 7 days`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Spend by day (last 14 days, estimated)">
          {spend.byDay.length === 0 ? <p className="text-sm text-slate-500">No usage recorded yet.</p> : (
            <table className="w-full"><thead><tr><th className={th}>Day</th><th className={th}>Calls</th><th className={th}>Est. cost</th></tr></thead>
              <tbody>{spend.byDay.map(d => <tr key={d.day}><td className={td}>{d.day}</td><td className={td}>{d.calls}</td><td className={td}>{usd(d.cost)}</td></tr>)}</tbody></table>
          )}
        </Card>
        <Card title="Top spenders this month">
          {spend.top.length === 0 ? <p className="text-sm text-slate-500">No usage recorded yet.</p> : (
            <table className="w-full"><thead><tr><th className={th}>User</th><th className={th}>Calls</th><th className={th}>Est. cost</th></tr></thead>
              <tbody>{spend.top.map(t => (
                <tr key={t.clerkId}>
                  <td className={td}>{t.userId ? <Link prefetch={false} className="text-amber-700 underline" href={`/admin/users/${t.userId}`}>{t.email}</Link> : t.clerkId}</td>
                  <td className={td}>{t.calls}</td><td className={td}>{usd(t.cost)}</td></tr>))}</tbody></table>
          )}
          {spend.byKind.length > 0 && <p className="text-xs text-slate-500 mt-3">By feature: {spend.byKind.map(k => `${k.kind} ${usd(k.cost)}`).join(' · ')}</p>}
        </Card>
      </div>

      <Card title="Recent failed generations (7 days)">
        {failures.length === 0 ? <p className="text-sm text-slate-500">None in the last 7 days.</p> : (
          <table className="w-full"><thead><tr><th className={th}>When</th><th className={th}>User</th><th className={th}>Property</th><th className={th}>Reason</th></tr></thead>
            <tbody>{failures.map(f => (
              <tr key={f.id}>
                <td className={td}>{fmtDate(f.createdAt)}</td>
                <td className={td}>{f.userId ? <Link prefetch={false} className="text-amber-700 underline" href={`/admin/users/${f.userId}`}>{f.email}</Link> : '—'}</td>
                <td className={td}>{f.address ?? '—'}</td>
                <td className={td}>{f.failureReason ?? <span className="text-slate-400">not recorded</span>} {f.refundedAt && <Badge tone="green">refunded</Badge>}</td>
              </tr>))}</tbody></table>
        )}
        <Link href="/admin/failures" prefetch={false} className="text-xs text-amber-700 underline mt-3 inline-block">All failures →</Link>
      </Card>
      <p className="text-xs text-slate-500">Costs are estimates from token counts / flat per-call reservations (see lib/ai-budget.ts) — reconcile against the Anthropic console for the real bill.</p>
    </div>
  )
}
