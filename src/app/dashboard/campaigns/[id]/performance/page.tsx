import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { checkCampaignQuota, getCampaign } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { formatListingAddress } from '@/lib/address'
import { loadPerformance } from '@/lib/performance/load'
import { rate } from '@/lib/performance/stats'
import { DailyBars } from '@/components/performance/bar-chart'
import { SellerReportCard } from './seller-report-card'
import { QrPanel } from './qr-panel'
import { loadQrRows } from '@/lib/qr/load'

export const metadata = { title: 'Listing Performance' }

const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v as object).length > 0 : !!v)

export default async function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [campaign, quota] = await Promise.all([getCampaign(id, userId), checkCampaignQuota(userId)])
  if (!campaign) notFound()
  const address = formatListingAddress(campaign.listing) || 'Listing'

  if (!canAccess(quota.planTier, 'performance_dashboard')) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h1 className="font-display text-xl font-semibold text-slate-900">Listing performance is a Starter feature</h1>
        <p className="text-sm text-slate-500 mt-2">See real views, clicks, inquiries and downloads for each listing.</p>
        <Link href="/dashboard/billing" className="inline-block bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl mt-5">See plans</Link>
      </div>
    )
  }

  const [perf, qrRows] = await Promise.all([loadPerformance(campaign.id, 30), loadQrRows(campaign.id)])
  if (!perf) notFound()
  const a = (campaign.analytics ?? {}) as Record<string, unknown>
  const ready: Array<[string, boolean]> = [
    ['Listing copy', has(a.listingCopy)], ['6-week social calendar', has(campaign.facebookPosts) || has(campaign.instagramPosts)],
    ['Just Listed / Still Available emails', has(campaign.emailJustListed)], ['Email templates', has(a.emailDrip)],
    ['Print materials', has(a.printMaterials)], ['Photo captions', has(a.photoCaptions)],
    ['Video & reel scripts', has(campaign.videoScript)], ['Microsite published', perf.published],
  ]
  const leadRate = rate(perf.leads.total, perf.viewsAllTime)

  const tiles: Array<[string, number | string, string?]> = [
    ['Microsite views (30 days)', perf.viewsInWindow, `${perf.viewsAllTime.toLocaleString()} all time`],
    ['Views (last 7 days)', perf.viewsLast7],
    ['Inquiries', perf.leads.total, `${perf.leads.showing} showing · ${perf.leads.info} info`],
    ['Call-button clicks (30 days)', perf.clicks.call],
    ['Email-button clicks (30 days)', perf.clicks.email],
    ['Flyer PDFs (30 days)', perf.downloads.flyerPdf],
    ['Graphics downloaded (30 days)', perf.downloads.kit],
    ['Days since campaign created', perf.campaignAgeDays],
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href={`/dashboard/campaigns/${campaign.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Back to campaign</Link>
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Listing performance</h1>
        <p className="text-sm text-slate-500 mt-1">{address}</p>
      </div>

      {!perf.published && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">This listing&apos;s microsite isn&apos;t published, so there are no views, clicks or inquiries to count yet. Publish it from the campaign page.</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="font-display text-2xl font-bold text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
            {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-display font-semibold text-slate-900">Daily microsite views — last 30 days</h2>
          {leadRate !== null && <span className="text-xs text-slate-500">{leadRate}% of all-time views became an inquiry</span>}
        </div>
        <DailyBars points={perf.views} label="Daily microsite views" />
        <p className="text-xs text-slate-400 mt-3">
          Counts exclude search-engine and link-preview bots and your own visits while signed in. These are page views, not unique people.
          {perf.trackingSince ? ` Daily tracking began ${perf.trackingSince}; earlier views appear only in the all-time total.` : perf.viewsAllTime > 0 ? ' Daily tracking starts with the next view; earlier views appear only in the all-time total.' : ''}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-slate-900">Where inquiries came from</h2>
            <Link href="/dashboard/leads" className="text-xs font-semibold text-amber-700 underline">Open leads</Link>
          </div>
          {perf.leads.sources.length === 0 ? <p className="text-sm text-slate-500">No inquiries yet. Add <code>?utm_source=instagram</code> to the microsite link you post and each inquiry shows its source.</p> : (
            <table className="w-full text-sm"><tbody>
              {perf.leads.sources.map(s => <tr key={s.source} className="border-t border-slate-100 first:border-0"><td className="py-2 text-slate-700">{s.source}</td><td className="py-2 text-right font-semibold text-slate-900">{s.count}</td></tr>)}
            </tbody></table>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-display font-semibold text-slate-900 mb-3">What&apos;s ready for this listing</h2>
          <ul className="space-y-1.5 text-sm">
            {ready.map(([label, ok]) => <li key={label} className={ok ? 'text-slate-800' : 'text-slate-400'}>{ok ? '✓' : '—'} {label}</li>)}
          </ul>
        </div>
      </div>

      <QrPanel campaignId={campaign.id} rows={qrRows} allowed={canAccess(quota.planTier, 'qr_codes')} published={perf.published} />

      <SellerReportCard campaignId={campaign.id} allowed={canAccess(quota.planTier, 'seller_report')} />

      <p className="text-xs text-slate-400">Social post reach and clicks aren&apos;t shown: ListOps doesn&apos;t publish to or read from social platforms yet, so it has no real numbers to report.</p>
    </div>
  )
}
