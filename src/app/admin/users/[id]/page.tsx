import Link from 'next/link'
import { formatStreet, formatCity } from '@/lib/address'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin'
import { getUserDetail } from '@/lib/admin-data'
import { logAudit } from '@/lib/audit'
import { Badge, Card, DesktopTable, KV, MobileItem, MobileList, Stat, fmtDate, statusTone, td, th, usd } from '../../_lib'
import { DeleteAccountForm, QuotaForm, RefundButton } from '../../_components/actions'

export const dynamic = 'force-dynamic'

export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage()
  const { id } = await params
  const d = await getUserDetail(id)
  if (!d) notFound()
  const { user: u } = d
  await logAudit({ action: 'admin.view_user', actorClerkId: admin.clerkId, actorEmail: admin.email, targetUserId: u.id })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900 break-all min-w-0 w-full sm:w-auto">{u.email}</h1>
        <Badge tone="slate">{d.plan}</Badge>
        {u.deletedAt ? <Badge tone="red">closed {fmtDate(u.deletedAt)}</Badge> : u.ageBlockedAt ? <Badge tone="red">blocked (under 18)</Badge> : !u.ageConfirmedAt ? <Badge tone="amber">age not confirmed</Badge> : <Badge tone="green">active</Badge>}
        <Link prefetch={false} href={`/admin/users/${u.id}/view`} className="w-full sm:w-auto sm:ml-auto text-center inline-flex items-center justify-center min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">View as user (read-only)</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Used this month" value={`${u.campaignsUsedThisMonth} / ${d.limit}`} sub={`period last reset ${fmtDate(u.lastResetAt)}`} />
        <Stat label="Generations all-time" value={u.campaignsUsedTotal} />
        <Stat label="AI spend, 30 days (est.)" value={usd(d.spend30d.cost)} sub={`${d.spend30d.calls} calls`} />
        <Stat label="Joined" value={<span className="text-base">{fmtDate(u.createdAt)}</span>} sub={`role: ${u.role}`} />
      </div>
      <p className="text-xs text-slate-500 break-all">User id <code>{u.id}</code> · Clerk id <code>{u.clerkId}</code></p>

      <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
        <Card title="Adjust quota / refund"><QuotaForm userId={u.id} /></Card>
        <Card title="Danger zone">{u.deletedAt ? <p className="text-sm text-slate-500">Account already closed.</p> : <DeleteAccountForm userId={u.id} email={u.email} />}</Card>
      </div>

      <Card title="Recent campaigns">
        {d.recentCampaigns.length === 0 ? <p className="text-sm text-slate-500">No campaigns yet.</p> : (
          <>
            <DesktopTable><thead><tr><th className={th}>When</th><th className={th}>Property</th><th className={th}>Status</th><th className={th}>Time</th><th className={th}>Detail</th><th className={th}></th></tr></thead>
              <tbody>{d.recentCampaigns.map(c => (
                <tr key={c.id}>
                  <td className={td}>{fmtDate(c.createdAt)}</td>
                  <td className={td}>{[formatStreet(c.address), formatCity(c.city)].filter(Boolean).join(', ') || '—'}</td>
                  <td className={td}><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                  <td className={td}>{c.generationMs ? `${Math.round(c.generationMs / 1000)}s` : '—'}</td>
                  <td className={td}>{c.failureReason ?? ''} {c.refundedAt && <Badge tone="green">refunded {fmtDate(c.refundedAt)}</Badge>}</td>
                  <td className={td}>{!c.refundedAt && (c.status === 'failed' || c.status === 'complete') && <RefundButton userId={u.id} campaignId={c.id} />}</td>
                </tr>))}</tbody></DesktopTable>
            <MobileList>{d.recentCampaigns.map(c => (
              <MobileItem key={c.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  <span className="text-xs text-slate-500">{fmtDate(c.createdAt)}</span>
                </div>
                <KV label="Property">{[formatStreet(c.address), formatCity(c.city)].filter(Boolean).join(', ') || '—'}</KV>
                <KV label="Time">{c.generationMs ? `${Math.round(c.generationMs / 1000)}s` : '—'}</KV>
                {(c.failureReason || c.refundedAt) && <KV label="Detail">{c.failureReason ?? ''} {c.refundedAt && <Badge tone="green">refunded {fmtDate(c.refundedAt)}</Badge>}</KV>}
                {!c.refundedAt && (c.status === 'failed' || c.status === 'complete') && <div className="pt-1"><RefundButton userId={u.id} campaignId={c.id} /></div>}
              </MobileItem>))}</MobileList>
          </>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
        <Card title="Recent AI usage">
          {d.recentUsage.length === 0 ? <p className="text-sm text-slate-500">None recorded.</p> : (
            <>
              <DesktopTable><thead><tr><th className={th}>When</th><th className={th}>Feature</th><th className={th}>Tokens in/out</th><th className={th}>Est.</th></tr></thead>
                <tbody>{d.recentUsage.map((r, i) => <tr key={i}><td className={td}>{fmtDate(r.at)}</td><td className={td}>{r.kind}</td><td className={td}>{r.inTok || '—'} / {r.outTok || '—'}</td><td className={td}>{usd(Number(r.cost))}</td></tr>)}</tbody></DesktopTable>
              <MobileList>{d.recentUsage.map((r, i) => (
                <MobileItem key={i}>
                  <div className="flex justify-between gap-2"><span className="font-medium">{r.kind}</span><span>{usd(Number(r.cost))}</span></div>
                  <div className="text-xs text-slate-500">{fmtDate(r.at)} · {r.inTok || '—'} in / {r.outTok || '—'} out</div>
                </MobileItem>))}</MobileList>
            </>
          )}
        </Card>
        <Card title="Audit trail for this user">
          {d.auditEntries.length === 0 ? <p className="text-sm text-slate-500">No entries.</p> : (
            <ul className="space-y-2 text-sm break-words">{d.auditEntries.map(a => {
              const m = (a.metadata ?? {}) as Record<string, unknown>
              return <li key={a.id} className="min-w-0"><span className="text-slate-500">{fmtDate(a.at)}</span> · <strong>{a.action}</strong> · {String(m.actorEmail ?? '')} {m.reason ? <em className="text-slate-600">“{String(m.reason)}”</em> : null}</li>
            })}</ul>
          )}
        </Card>
      </div>
    </div>
  )
}
