import Link from 'next/link'
import { formatStreet, formatCity } from '@/lib/address'
import { requireAdminPage } from '@/lib/admin'
import { getRecentFailures } from '@/lib/admin-data'
import { Badge, Card, DesktopTable, KV, MobileItem, MobileList, fmtDate, linkCls, td, th } from '../_lib'

export const dynamic = 'force-dynamic'

export default async function AdminFailures() {
  await requireAdminPage()
  const rows = await getRecentFailures(100)
  return (
    <Card title={`Failed generations (latest ${rows.length})`}>
      <p className="text-xs text-slate-500 mb-3">Reasons are short user-safe summaries. For the full error and stack trace, search the matching time in Sentry / Vercel logs. Refund from the user’s page.</p>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No failures recorded.</p> : (
        <>
          <DesktopTable><thead><tr><th className={th}>When</th><th className={th}>User</th><th className={th}>Property</th><th className={th}>Duration</th><th className={th}>Reason</th></tr></thead>
            <tbody>{rows.map(f => (
              <tr key={f.id}>
                <td className={td}>{fmtDate(f.createdAt)}</td>
                <td className={`${td} break-all`}>{f.userId ? <Link prefetch={false} className="text-amber-700 underline" href={`/admin/users/${f.userId}`}>{f.email}</Link> : '—'}</td>
                <td className={td}>{[formatStreet(f.address), formatCity(f.city)].filter(Boolean).join(', ') || '—'}</td>
                <td className={td}>{f.generationMs ? `${Math.round(f.generationMs / 1000)}s` : '—'}</td>
                <td className={td}>{f.failureReason ?? <span className="text-slate-400">not recorded (older than this feature)</span>} {f.refundedAt && <Badge tone="green">refunded</Badge>}</td>
              </tr>))}</tbody></DesktopTable>
          <MobileList>{rows.map(f => (
            <MobileItem key={f.id}>
              <KV label="When">{fmtDate(f.createdAt)}</KV>
              <KV label="User">{f.userId ? <Link prefetch={false} className={linkCls} href={`/admin/users/${f.userId}`}>{f.email}</Link> : '—'}</KV>
              <KV label="Property">{[formatStreet(f.address), formatCity(f.city)].filter(Boolean).join(', ') || '—'}</KV>
              <KV label="Duration">{f.generationMs ? `${Math.round(f.generationMs / 1000)}s` : '—'}</KV>
              <KV label="Reason">{f.failureReason ?? <span className="text-slate-400">not recorded (older than this feature)</span>} {f.refundedAt && <Badge tone="green">refunded</Badge>}</KV>
            </MobileItem>))}</MobileList>
        </>
      )}
    </Card>
  )
}
