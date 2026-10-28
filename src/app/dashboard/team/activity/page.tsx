import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ACTION_LABELS, getOrgActivity, getTeamAdminContext } from '@/lib/team-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Team activity log' }

const fmt = (d: Date | string) => new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

export default async function TeamActivityPage() {
  const ctx = await getTeamAdminContext() // plan + role checked server-side on every request
  if (!ctx) redirect('/dashboard/team')
  const rows = await getOrgActivity(ctx.orgId)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <Link href="/dashboard/team" className="text-sm text-slate-500 underline">← Team</Link>
        <h1 className="font-display text-2xl font-semibold text-slate-900 mt-2">Team activity log</h1>
        <p className="text-sm text-slate-500 mt-1">A record of sensitive actions taken by your team: listing deletions, invitations, outreach sends, billing events and account consent. Kept for 2 years.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {rows.length === 0 ? <p className="p-6 text-sm text-slate-500">No activity recorded yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 bg-slate-50"><th className="px-4 py-2">When</th><th className="px-4 py-2">Who</th><th className="px-4 py-2">What</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 whitespace-nowrap text-slate-600">{fmt(r.at)}</td>
                <td className="px-4 py-2">{[r.actorFirst, r.actorLast].filter(Boolean).join(' ') || r.actorEmail || '—'}</td>
                <td className="px-4 py-2">{ACTION_LABELS[r.action] ?? r.action}</td>
              </tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}
