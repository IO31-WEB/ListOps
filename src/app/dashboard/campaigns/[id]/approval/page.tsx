import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { checkCampaignQuota, getCampaign } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { formatListingAddress } from '@/lib/address'
import { ApprovalCard } from './approval-card'

export const metadata = { title: 'Seller Approval' }

export default async function ApprovalDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [campaign, quota] = await Promise.all([getCampaign(id, userId), checkCampaignQuota(userId)])
  if (!campaign) notFound()
  const allowed = canAccess(quota.planTier, 'seller_approval')
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={`/dashboard/campaigns/${campaign.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Back to campaign</Link>
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Seller approval</h1>
        <p className="text-sm text-slate-500 mt-1">{formatListingAddress(campaign.listing) || 'Listing'} · send your seller a private link to approve the listing description, posts and email before they go out.</p>
      </div>
      {allowed
        ? <ApprovalCard campaignId={campaign.id} />
        : (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h2 className="font-display text-lg font-semibold text-slate-900">Seller approval is a Pro feature</h2>
            <p className="text-sm text-slate-500 mt-2">Get a dated record that your seller approved the exact text, or tell you what to change.</p>
            <Link href="/dashboard/billing" className="inline-block bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl mt-5">See plans</Link>
          </div>
        )}
    </div>
  )
}
