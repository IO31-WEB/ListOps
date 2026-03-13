import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, Mail, Lock, ArrowRight, Crown, Shield, User } from 'lucide-react'
import { getDashboardStats, getTeamMembers } from '@/lib/user-service'

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
  const canManageTeam = ['pro', 'commercial', 'brokerage', 'enterprise'].includes(planTier)
  const teamMembers = canManageTeam && user.orgId ? await getTeamMembers(user.orgId) : [user]

  const maxAgents = {
  free: 1,
  starter: 1,
  pro: 3,
  brokerage: 25,
  enterprise: 999,
  commercial: 50,  // ← Add this! Adjust the number to whatever limit you want for commercial tier (e.g., 50 agents, unlimited-ish, etc.)
}[planTier] ?? 1;
  const canAddMore = teamMembers.length < maxAgents

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-1">
            {teamMembers.length} of {maxAgents === 999 ? 'unlimited' : maxAgents} seats used
          </p>
        </div>
        {canManageTeam && canAddMore && (
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
                Pro plan includes 3 agent seats. Brokerage plan includes 25 seats with admin dashboard, 
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
              <div key={member.id} className="flex items-center gap-4 px-6 py-4">
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
                  <p className="text-sm font-semibold text-slate-900">
                    {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email}
                  </p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${roleConfig.color}`}>
                    <RoleIcon className="w-3 h-3" />
                    {roleConfig.label}
                  </span>
                  {member.id === user.id && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">You</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {canManageTeam && canAddMore && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <Link href="/dashboard/team/invite" className="flex items-center gap-2 text-sm text-amber-700 font-medium hover:underline">
              <Plus className="w-4 h-4" />
              Invite another agent ({maxAgents - teamMembers.length} seat{maxAgents - teamMembers.length !== 1 ? 's' : ''} remaining)
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
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🎨', title: 'White-Label', desc: 'Your brand on all outputs — no ListOps branding shown to agents or clients.' },
              { icon: '📊', title: 'Admin Dashboard', desc: 'See campaign activity across all agents in your workspace.' },
              { icon: '📋', title: 'Audit Logs', desc: 'Full compliance trail of all actions for all agents.' },
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
