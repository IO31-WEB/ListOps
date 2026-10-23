import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin'
import { getAuditLog } from '@/lib/admin-data'
import { Card, fmtDate, td, th } from '../_lib'

export const dynamic = 'force-dynamic'

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireAdminPage()
  const { action = '' } = await searchParams
  const rows = await getAuditLog({ limit: 150, actionPrefix: action })
  const filters = ['', 'admin.', 'user.', 'listing.', 'billing.', 'team.', 'outreach.']
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {filters.map(f => <Link key={f || 'all'} prefetch={false} href={f ? `/admin/audit?action=${f}` : '/admin/audit'} className={`rounded-full px-3 py-1 border ${action === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}>{f ? `${f}*` : 'All'}</Link>)}
      </div>
      <Card title={`Audit log (latest ${rows.length})`}>
        <table className="w-full"><thead><tr><th className={th}>When</th><th className={th}>Action</th><th className={th}>Actor</th><th className={th}>Target</th><th className={th}>Details</th><th className={th}>IP</th></tr></thead>
          <tbody>{rows.map(r => {
            const m = (r.metadata ?? {}) as Record<string, unknown>
            const { actorClerkId: _a, actorEmail: _e, targetEmail: _t, ...rest } = m
            return (
              <tr key={r.id}>
                <td className={td}>{fmtDate(r.at)}</td><td className={td}><strong>{r.action}</strong></td>
                <td className={td}>{String(m.actorEmail ?? m.actorClerkId ?? '—')}</td>
                <td className={td}>{r.resourceType === 'user' && r.resourceId ? <Link prefetch={false} className="text-amber-700 underline" href={`/admin/users/${r.resourceId}`}>{r.targetEmail ?? r.resourceId}</Link> : '—'}</td>
                <td className={`${td} text-xs max-w-xs break-words`}>{Object.keys(rest).length ? JSON.stringify(rest) : ''}</td>
                <td className={td}>{r.ip ?? ''}</td>
              </tr>)})}</tbody></table>
      </Card>
    </div>
  )
}
