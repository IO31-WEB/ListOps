import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { Building2, Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { campaigns, users } from '@/lib/db/schema'
import { formatListingAddress } from '@/lib/address'
import { USE_TYPE_LABEL, readCommercial } from '@/lib/commercial/types'

export const metadata = { title: 'Commercial Campaigns' }

export default async function CommercialHome() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId), columns: { id: true } })
  if (!user) redirect('/onboarding')
  const rows = await db.query.campaigns.findMany({
    where: and(eq(campaigns.agentId, user.id), eq(campaigns.campaignType, 'commercial')),
    with: { listing: true }, orderBy: [desc(campaigns.createdAt)], limit: 50,
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2"><Building2 className="w-6 h-6 text-slate-400" /> Commercial campaigns</h1>
          <p className="text-sm text-slate-500 mt-1">Add the property, photos and highlights. ListOps writes the offering teaser, one-pager, LinkedIn and Facebook posts, a 4-email broker/investor sequence, a one-sheet and a teaser page.</p>
        </div>
        <Link href="/dashboard/generate?type=commercial" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"><Plus className="w-4 h-4" /> New commercial campaign</Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
          No commercial campaigns yet. Start with an address, a property type and a few highlights. Nothing else is required.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(c => {
            const d = readCommercial(c.listing?.commercial)
            return (
              <li key={c.id}>
                <Link href={`/dashboard/campaigns/${c.id}`} className="block bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 transition-colors">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-slate-900">{formatListingAddress(c.listing) || 'Commercial property'}</span>
                    {d && <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-0.5">{USE_TYPE_LABEL[d.useType]} · {d.offering === 'lease' ? 'For lease' : 'For sale'}</span>}
                    <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${c.status === 'complete' ? 'bg-green-100 text-green-700' : c.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.status}</span>
                    <span className="text-xs text-slate-400 ml-auto">{c.createdAt.toLocaleDateString('en-US')}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
