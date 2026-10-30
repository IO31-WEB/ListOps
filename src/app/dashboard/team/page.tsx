import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, Mail, Lock, ArrowRight, Crown, Shield, User, BarChart2, ClipboardList, Download } from 'lucide-react'
import { getDashboardStats, getTeamMembers } from '@/lib/user-service'
import { listPendingInvites } from '@/lib/team-invites'
import { canAccess, seatLimitFor } from '@/lib/plans'
import { RemoveMemberButton, RevokeInviteButton } from './member-actions'

export const metadata = { title: 'Team' }

const ROLE_LABELS: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  owner: { label: 'Owner', icon: Crown, color: 'text-amber-700 bg-amber-100' },
  admin: { label: 'Admin', icon: Shield, color: 'text-blue-700 bg-blue-100' },
  agent: { label: 'Agent', icon: User, color: 'text-slate-700 bg-slate-100' },
  viewer: { label: 'Viewer', icon: User, color: 'text-slate-600 bg-slate-100' },
}

export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const stats = await getDashboardStats(userId)
  if (!stats) redirect('/onboarding')

  const { planTier, user } = stats
  const canManageTeam = canAccess(planTier, 'team_seats')
  const isManager = user.role === 'owner' || user.role === 'admin'
  const teamMembers = canManageTeam && user.orgId ? await getTeamMembers(user.orgId) : [user]
  const pendingInvites = canManageTeam && isManager && user.orgId ? await listPendingInvites(user.orgId) : []

  // HARD seat limit from the single source of truth (lib/plans.ts). Pending invites hold a seat too.
  const maxAgents = seatLimitFor(planTier)
  const seatsUsed = teamMembers.length + pendingInvites.length
  const canAddMore = seatsUsed < maxAgents

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-1">
            {seatsUsed} of {maxAgents === 999 ? 'unlimited' : maxAgents} seats used{pendingInvites.length > 0 ? ` (${pendingInvites.length} pending invite${pendingInvites.length === 1 ? '' : 's'})` : ''}
          </p>
        </div>
        {['brokerage', 'enterprise'].includes(planTier) && (
          <Link href="/dashboard/team/compliance" className="inline-flex items-center gap-2 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            Compliance profile
          </Link>
        )}
        {canManageTeam && isManager && canAddMore && (
          <Link
            href="/dashboard/team/invite"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Invite Agent
          </Link>
        )}
      </div>

      {/* Upgrade CTA for free/starter */}
      {!canManageTeam && (
        <div className="bg-white rounded-2xl border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">Team features require Pro+</h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Pro and Commercial include 2 seats (you plus one teammate). Brokerage includes 25 seats with agent performance analytics, 
                white-label outputs, and compliance tools.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/billing?plan=pro" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors">
                  Upgrade to Pro — $79/mo <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link href="/dashboard/billing?plan=brokerage" className="inline-flex items-center gap-2 bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors">
                  Brokerage — $299/mo <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team members list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-display font-semibold text-slate-900">Members</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {teamMembers.map((member: any) => {
            const roleConfig = ROLE_LABELS[member.role] ?? ROLE_LABELS.agent
            const RoleIcon = roleConfig.icon
            return (
              <div key={member.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-4">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.firstName ?? ''} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-600">
                      {(member.firstName?.[0] ?? member.email[0]).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{member.email}</p>
                </div>
                {/* Below the name/email on phones (full row, indented past the avatar); inline on sm+ */}
                <div className="flex items-center gap-2 flex-shrink-0 w-full pl-14 sm:w-auto sm:pl-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${roleConfig.color}`}>
                    <RoleIcon className="w-3 h-3" />
                    {roleConfig.label}
                  </span>
                  {member.id === user.id && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">You</span>
                  )}
                  {isManager && member.id !== user.id && member.role !== 'owner' && (user.role === 'owner' || member.role !== 'admin') && (
                    <RemoveMemberButton id={member.id} name={[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {pendingInvites.length > 0 && (
          <div className="border-t border-slate-100">
            <p className="px-6 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Pending invites (each holds a seat)</p>
            <div className="divide-y divide-slate-100">
              {pendingInvites.map(inv => (
                <div key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate">{inv.email}</p>
                    <p className="text-xs text-slate-500">{inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString('en-US')}</p>
                  </div>
                  <RevokeInviteButton id={inv.id} />
                </div>
              ))}
            </div>
          </div>
        )}

        {canManageTeam && isManager && canAddMore && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <Link href="/dashboard/team/invite" className="flex items-center gap-2 text-sm text-amber-700 font-medium hover:underline">
              <Plus className="w-4 h-4" />
              Invite another agent ({maxAgents - seatsUsed} seat{maxAgents - seatsUsed !== 1 ? 's' : ''} remaining)
            </Link>
          </div>
        )}
      </div>

      {/* Brokerage features callout */}
      {planTier === 'brokerage' || planTier === 'enterprise' ? (
        <div className="bg-slate-900 rounded-2xl p-6 grain">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">Brokerage Features Active</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
            <Link href="/dashboard/analytics" className="inline-flex items-center justify-center gap-2 bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-amber-300 shadow-sm transition-colors">
              <BarChart2 className="w-4 h-4" />Agent performance
            </Link>
            <Link href="/dashboard/team/activity" className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/5 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors">
              <ClipboardList className="w-4 h-4" />Team activity log
            </Link>
            <a href="/api/team/export" download className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/5 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors">
              <Download className="w-4 h-4" />Export campaigns (CSV)
            </a>
            <span className="text-xs text-slate-400 sm:ml-1">Owners and admins only</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🎨', title: 'White-Label', desc: 'Your brokerage name, logo and colors on all generated content and flyers (set up in Brand Kit).' },
              { icon: '📊', title: 'Agent Performance', desc: 'Campaigns generated, microsite views and last activity for every agent, plus CSV export of all team campaigns.' },
              { icon: '📋', title: 'Team Activity Log', desc: 'A record of sensitive actions: invitations, listing deletions, outreach sends and billing events.' },
            ].map(f => (
              <div key={f.title} className="bg-slate-800 rounded-xl p-4">
                <div className="text-xl mb-2">{f.icon}</div>
                <div className="font-semibold text-white text-sm mb-1">{f.title}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
