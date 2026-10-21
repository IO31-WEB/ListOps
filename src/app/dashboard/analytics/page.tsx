import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, TrendingUp, Eye, FileText, Clock, Zap, Lock, ArrowRight } from 'lucide-react'
import { getDashboardStats } from '@/lib/user-service'

export const metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const stats = await getDashboardStats(userId)
  if (!stats) redirect('/onboarding')

  const { planTier, totalCampaigns, campaignsThisMonth, micrositeViews, avgGenTimeMs, recentCampaigns } = stats
  const isBrokerage = ['brokerage', 'enterprise'].includes(planTier)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Campaign performance and usage metrics</p>
      </div>

      {/* Basic stats — all plans */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: totalCampaigns, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'This Month', value: campaignsThisMonth, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Microsite Views', value: micrositeViews.toLocaleString(), icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Avg. Gen Time', value: avgGenTimeMs > 0 ? `${Math.round(avgGenTimeMs / 1000)}s` : '~58s', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="font-display text-2xl font-bold text-slate-900 mb-0.5">{stat.value}</div>
            <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent campaign performance */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-display font-semibold text-slate-900">Recent Campaign Performance</h3>
          <Link href="/dashboard/campaigns" className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No campaigns yet. Generate your first to see analytics.</p>
            <Link href="/dashboard/generate" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors mt-4">
              <Zap className="w-4 h-4" /> Generate Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentCampaigns.map((campaign: any) => {
              const address = [campaign.listing?.address, campaign.listing?.city, campaign.listing?.state]
                .filter(Boolean).join(', ')
              return (
                <div key={campaign.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{address || 'Campaign'}</p>
                      <p className="text-xs text-slate-500">
                        {campaign.generationMs ? `${(campaign.generationMs / 1000).toFixed(1)}s to generate` : 'Generated'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {campaign.micrositePublished && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{campaign.micrositeViews ?? 0}</p>
                        <p className="text-xs text-slate-500">Microsite views</p>
                      </div>
                    )}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${campaign.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Brokerage Analytics — locked for lower tiers */}
      {!isBrokerage && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-display font-semibold text-slate-900">Advanced Analytics</h3>
          </div>
          <div className="p-8 sm:p-12 text-center relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white pointer-events-none z-10" />
            <div className="space-y-3 opacity-30 pointer-events-none mb-8">
              {['Agent Performance', 'Campaign ROI', 'Content Engagement', 'Listing Performance'].map(item => (
                <div key={item} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="relative z-20">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-amber-700" />
              </div>
              <h4 className="font-display text-lg font-semibold text-slate-900 mb-2">Brokerage Analytics</h4>
              <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                Track performance across all agents, campaigns, and listings. Available on Brokerage plan.
              </p>
              <Link href="/dashboard/billing" className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors text-sm">
                Upgrade to Brokerage <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
