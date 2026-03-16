import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, TrendingUp, Zap, ArrowRight, Clock, FileText, BarChart2, Palette, Users, CheckCircle, AlertTriangle } from 'lucide-react'
import { getDashboardStats } from '@/lib/user-service'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const stats = await getDashboardStats(userId)
  if (!stats) {
  const { getOrCreateUser } = await import('@/lib/user-service')
  const { currentUser } = await import('@clerk/nextjs/server')
  const clerkUser = await currentUser()
  if (clerkUser) {
    await getOrCreateUser(userId, {
      email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
      firstName: clerkUser.firstName ?? undefined,
      lastName: clerkUser.lastName ?? undefined,
      avatarUrl: clerkUser.imageUrl ?? undefined,
    })
  }
  redirect('/onboarding')
}

  const { planTier, totalCampaigns, campaignsThisMonth, campaignLimit, recentCampaigns,
          avgGenTimeMs, micrositeViews, daysUntilReset, hasBrandKit, subscription } = stats

  const isAtLimit = campaignLimit !== 'unlimited' && campaignsThisMonth >= (campaignLimit as number)
  const nearLimit = campaignLimit !== 'unlimited' && campaignsThisMonth >= (campaignLimit as number) - 1
  const avgGenSec = avgGenTimeMs > 0 ? `${Math.round(avgGenTimeMs / 1000)}s` : '~58s'
  const usagePercent = campaignLimit === 'unlimited' ? 0 : Math.round((campaignsThisMonth / (campaignLimit as number)) * 100)

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">

      {/* Welcome Hero */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white grain relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-white/2 rounded-full pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">ListOps</span>
              <span className="text-xs text-slate-500 capitalize bg-slate-800 px-2 py-0.5 rounded-full ml-1">{planTier} plan</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-2">
              Ready to generate your next campaign?
            </h2>
            <p className="text-slate-400 text-sm">Paste your MLS ID and get a complete 6-week campaign in ~2 minutes.</p>
          </div>
          <Link
            href="/dashboard/generate"
            className="flex-shrink-0 inline-flex items-center gap-2 bg-amber-400 text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-amber-300 transition-all hover:shadow-lg hover:shadow-amber-400/20"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {isAtLimit && planTier !== 'pro' && planTier !== 'brokerage' && planTier !== 'enterprise' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">
                You've used all {campaignLimit} {planTier === 'free' ? 'free ' : ''}campaigns this month
              </p>
              <p className="text-xs text-red-700">Resets in {daysUntilReset} days • Upgrade to generate unlimited campaigns.</p>
            </div>
          </div>
          <Link href="/dashboard/billing" className="flex-shrink-0 text-sm font-semibold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
            Upgrade
          </Link>
        </div>
      )}

      {!isAtLimit && nearLimit && planTier !== 'pro' && planTier !== 'brokerage' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-900">
              <strong>1 campaign remaining</strong> this month. Resets in {daysUntilReset} days.
            </p>
          </div>
          <Link href="/dashboard/billing" className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap">
            Upgrade →
          </Link>
        </div>
      )}

      {!hasBrandKit && planTier !== 'free' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Palette className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-900">
              <strong>Set up your Brand Kit</strong> — your logo, colors, and contact info will be applied to every campaign automatically.
            </p>
          </div>
          <Link href="/dashboard/brand" className="text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Set Up
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: 'This Month',
            value: campaignLimit === 'unlimited' ? `${campaignsThisMonth}` : `${campaignsThisMonth} / ${campaignLimit}`,
            sub: campaignLimit === 'unlimited' ? 'Unlimited plan' : `${daysUntilReset}d until reset`,
            icon: FileText,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            progress: usagePercent,
          },
          {
            label: 'Total Campaigns',
            value: totalCampaigns,
            sub: 'All time',
            icon: TrendingUp,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: 'Avg. Generation',
            value: avgGenSec,
            sub: 'Per campaign',
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'Microsite Views',
            value: micrositeViews.toLocaleString(),
            sub: 'All listings',
            icon: BarChart2,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200">
            <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="font-display text-2xl font-bold text-slate-900 mb-0.5">{stat.value}</div>
            <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
            {stat.sub && <div className="text-xs text-slate-400 mt-0.5">{stat.sub}</div>}
            {stat.progress !== undefined && stat.progress > 0 && (
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${stat.progress >= 100 ? 'bg-red-500' : stat.progress >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(stat.progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Campaigns */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
          <h3 className="font-display text-lg font-semibold text-slate-900">Recent Campaigns</h3>
          <Link href="/dashboard/campaigns" className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <h4 className="font-display text-lg font-semibold text-slate-900 mb-2">No campaigns yet</h4>
            <p className="text-slate-500 text-sm mb-6">Generate your first campaign from an MLS listing ID.</p>
            <Link href="/dashboard/generate" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors">
              <Plus className="w-4 h-4" /> Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentCampaigns.map((campaign) => {
              const address = campaign.listing
                ? `${campaign.listing.address ?? ''}, ${campaign.listing.city ?? ''} ${campaign.listing.state ?? ''}`.trim().replace(/^,|,$/g, '')
                : 'Listing Campaign'

              return (
                <Link
                  key={campaign.id}
                  href={`/dashboard/campaigns/${campaign.id}`}
                  className="flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{address || 'Campaign'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {campaign.listing?.price
                        ? `$${Number(campaign.listing.price).toLocaleString()} • `
                        : ''}
                      {formatDate(campaign.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                      campaign.status === 'complete' ? 'bg-green-100 text-green-700' :
                      campaign.status === 'generating' ? 'bg-amber-100 text-amber-700' :
                      campaign.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {campaign.status}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            title: hasBrandKit ? 'Brand Kit ✓' : 'Set Up Brand Kit',
            desc: hasBrandKit
              ? 'Your brand is applied to every campaign automatically.'
              : 'Upload your logo, photo & colors to auto-brand every campaign.',
            href: '/dashboard/brand',
            icon: '🎨',
            cta: hasBrandKit ? 'Edit brand' : 'Set up now',
            urgent: !hasBrandKit && planTier !== 'free',
            done: hasBrandKit,
          },
          {
            title: planTier === 'free' ? 'Upgrade to Starter' : planTier === 'starter' ? 'Upgrade to Pro' : 'Manage Team',
            desc: planTier === 'free'
              ? 'Get Brand Kit, 5 campaigns/month, and remove ListOps branding.'
              : planTier === 'starter'
              ? 'Unlock unlimited campaigns, social scheduling & listing microsites.'
              : 'Add agents to your workspace for shared campaigns.',
            href: planTier === 'pro' || planTier === 'brokerage' ? '/dashboard/team' : '/dashboard/billing',
            icon: planTier === 'pro' || planTier === 'brokerage' ? '👥' : '⚡',
            cta: planTier === 'pro' || planTier === 'brokerage' ? 'Manage team' : 'See plans',
            urgent: planTier === 'free',
            done: false,
          },
          {
            title: 'Analytics',
            desc: 'Track microsite views, email opens, and campaign performance.',
            href: '/dashboard/analytics',
            icon: '📊',
            cta: 'View analytics',
            urgent: false,
            done: false,
          },
        ].map((action) => (
          <div key={action.title} className={`bg-white rounded-xl p-5 border ${action.urgent ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{action.icon}</span>
              {action.done && <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />}
            </div>
            <h4 className="font-semibold text-slate-900 text-sm mb-1">{action.title}</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">{action.desc}</p>
            <Link href={action.href} className={`text-xs font-semibold flex items-center gap-1 ${action.urgent ? 'text-amber-700' : 'text-slate-700'} hover:underline`}>
              {action.cta} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
