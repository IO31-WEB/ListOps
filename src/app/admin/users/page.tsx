import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin'
import { searchUsers, planOf, monthlyLimitOf } from '@/lib/admin-data'
import { logAudit } from '@/lib/audit'
import { Badge, Card, fmtDate, td, th } from '../_lib'

export const dynamic = 'force-dynamic'

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdminPage()
  const { q = '' } = await searchParams
  const results = await searchUsers(q)
  // Looking up people's personal data is itself a sensitive action -> logged.
  if (q.trim()) await logAudit({ action: 'admin.search_users', actorClerkId: admin.clerkId, actorEmail: admin.email, metadata: { query: q.trim().slice(0, 100), results: results.length } })

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Email, name, user id (uuid) or Clerk id" className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm" autoFocus />
        <button className="rounded-lg bg-slate-900 px-5 text-sm font-medium text-white">Search</button>
      </form>
      <Card title={q.trim() ? `Results for “${q.trim()}”` : 'Newest users'}>
        {results.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : (
          <table className="w-full"><thead><tr>
            <th className={th}>Email</th><th className={th}>Name</th><th className={th}>Plan</th><th className={th}>Used / limit</th><th className={th}>Joined</th><th className={th}>Status</th></tr></thead>
            <tbody>{results.map(u => {
              const plan = planOf(u)
              return (
                <tr key={u.id}>
                  <td className={td}><Link prefetch={false} className="text-amber-700 underline" href={`/admin/users/${u.id}`}>{u.email}</Link></td>
                  <td className={td}>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className={td}><Badge tone="slate">{plan}</Badge></td>
                  <td className={td}>{u.campaignsUsedThisMonth} / {monthlyLimitOf(plan)}</td>
                  <td className={td}>{fmtDate(u.createdAt)}</td>
                  <td className={td}>{u.deletedAt ? <Badge tone="red">closed</Badge> : u.ageBlockedAt ? <Badge tone="red">blocked</Badge> : !u.ageConfirmedAt ? <Badge tone="amber">age unconfirmed</Badge> : <Badge tone="green">active</Badge>}</td>
                </tr>)})}</tbody></table>
        )}
      </Card>
    </div>
  )
}
