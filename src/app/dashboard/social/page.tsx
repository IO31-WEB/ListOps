import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, asc, desc, eq, gte, lte, ne } from 'drizzle-orm'
import { CalendarDays, Download, Lock, ArrowRight } from 'lucide-react'
import { db } from '@/lib/db'
import { campaigns, socialPosts, socialSettings, users } from '@/lib/db/schema'
import { checkCampaignQuota } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { formatListingAddress } from '@/lib/address'
import { derivedStatus } from '@/lib/social/plan'
import { isValidTimeZone, localParts } from '@/lib/social/time'
import { SocialPlanner } from './planner'
import { SocialPostCard, type PostView } from './post-card'
import { DigestToggle } from './digest-toggle'

export const metadata = { title: 'Social Calendar' }

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  if (!user) redirect('/onboarding')
  const { planTier } = await checkCampaignQuota(userId)

  if (!canAccess(planTier, 'social_scheduling')) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h1 className="font-display text-xl font-semibold text-slate-900">The social calendar is a Pro feature</h1>
        <p className="text-sm text-slate-500 mt-2">Put every Facebook, Instagram and LinkedIn post from your 6-week campaign on a dated calendar, get a daily email when posts are due, and export to CSV or your calendar app.</p>
        <Link href="/dashboard/billing" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl mt-5">See plans <ArrowRight className="w-4 h-4" /></Link>
      </div>
    )
  }

  const sp = await searchParams
  const tz = isValidTimeZone(user.timezone) ? user.timezone : 'America/New_York'
  const now = new Date()
  const [rows, recent, settings] = await Promise.all([
    db.query.socialPosts.findMany({
      where: and(eq(socialPosts.agentId, user.id), ne(socialPosts.status, 'skipped'), gte(socialPosts.scheduledFor, new Date(now.getTime() - 14 * 86_400_000)), lte(socialPosts.scheduledFor, new Date(now.getTime() + 90 * 86_400_000))),
      with: { campaign: { with: { listing: true } } }, orderBy: [asc(socialPosts.scheduledFor)], limit: 400,
    }),
    db.query.campaigns.findMany({ where: eq(campaigns.agentId, user.id), with: { listing: true }, orderBy: [desc(campaigns.createdAt)], limit: 30 }),
    db.query.socialSettings.findFirst({ where: eq(socialSettings.userId, user.id) }),
  ])

  const posts: (PostView & { day: string })[] = rows.map(r => {
    const l = localParts(r.scheduledFor, tz)
    return {
      id: r.id, channel: r.channel, body: r.body, status: r.status, derived: derivedStatus(r.status, r.scheduledFor, now), notes: r.notes ?? '',
      scheduledLocal: `${l.date}T${l.time}`, property: formatListingAddress(r.campaign?.listing) || 'Listing', week: r.week, day: l.date,
    }
  })
  const todayKey = localParts(now, tz).date
  const days = [...new Set(posts.map(p => p.day))]
  const count = (f: (p: PostView) => boolean) => posts.filter(f).length
  const tiles: [string, number][] = [
    ['Due now', count(p => p.derived === 'due' || p.derived === 'overdue')],
    ['Upcoming', count(p => p.derived === 'scheduled')],
    ['Posted (last 14 days+)', count(p => p.derived === 'posted')],
  ]
  const campaignOptions = recent.map(c => ({ id: c.id, label: formatListingAddress(c.listing) || 'Campaign', hasSocial: c.status === 'complete' }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2"><CalendarDays className="w-6 h-6 text-slate-400" /> Social calendar</h1>
          <p className="text-sm text-slate-500 mt-1">Your campaign posts on dates, with a daily reminder. Times shown in {tz}. You post manually: copy, open the network, paste, then mark posted.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/social/export?format=csv" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><Download className="w-4 h-4" /> CSV</a>
          <a href="/api/social/export?format=ics" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><Download className="w-4 h-4" /> Calendar (.ics)</a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="font-display text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <SocialPlanner campaigns={campaignOptions} preselect={sp.campaign} today={todayKey} />

      <div className="space-y-5">
        {days.length === 0 && <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">Nothing scheduled yet. Pick a campaign above and a start date to fill your calendar.</div>}
        {days.map(day => (
          <section key={day}>
            <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 ${day === todayKey ? 'text-slate-900' : 'text-slate-400'}`}>{day === todayKey ? `Today · ${day}` : day}</h2>
            <div className="space-y-3">{posts.filter(p => p.day === day).map(p => <SocialPostCard key={p.id} post={p} />)}</div>
          </section>
        ))}
      </div>

      <DigestToggle initial={settings?.digest ?? true} />
    </div>
  )
}
