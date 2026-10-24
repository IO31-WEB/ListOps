import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, gte, type SQL } from 'drizzle-orm'
import { Inbox, Download, Lock, ArrowRight } from 'lucide-react'
import { db } from '@/lib/db'
import { leads, users } from '@/lib/db/schema'
import { checkCampaignQuota } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { formatListingAddress } from '@/lib/address'
import { LEAD_STATUSES } from '@/lib/leads/input'
import { LeadActions } from './lead-actions'
import { LeadSettingsPanel } from './lead-settings'

export const metadata = { title: 'Leads' }

const TIME: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', anytime: 'Anytime' }
const BADGE: Record<string, string> = { new: 'bg-amber-100 text-amber-800', contacted: 'bg-blue-100 text-blue-800', closed: 'bg-slate-100 text-slate-600' }

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  if (!user) redirect('/onboarding')
  const { planTier } = await checkCampaignQuota(userId)

  if (!canAccess(planTier, 'lead_capture')) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h1 className="font-display text-xl font-semibold text-slate-900">Lead capture is a Starter feature</h1>
        <p className="text-sm text-slate-500 mt-2">Add &quot;Schedule a Showing&quot; and &quot;Request Info&quot; forms to every listing microsite and get instant email alerts.</p>
        <Link href="/dashboard/billing" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl mt-5">See plans <ArrowRight className="w-4 h-4" /></Link>
      </div>
    )
  }

  const sp = await searchParams
  const status = (LEAD_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as (typeof LEAD_STATUSES)[number]) : undefined
  const conds: SQL[] = [eq(leads.agentId, user.id)]
  if (status) conds.push(eq(leads.status, status))

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [rows, [{ total }], [{ fresh }], [{ week }]] = await Promise.all([
    db.query.leads.findMany({ where: and(...conds), with: { listing: true }, orderBy: [desc(leads.createdAt)], limit: 200 }),
    db.select({ total: count() }).from(leads).where(eq(leads.agentId, user.id)),
    db.select({ fresh: count() }).from(leads).where(and(eq(leads.agentId, user.id), eq(leads.status, 'new'))),
    db.select({ week: count() }).from(leads).where(and(eq(leads.agentId, user.id), gte(leads.createdAt, weekAgo))),
  ])
  const canExport = canAccess(planTier, 'lead_export')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500 mt-1">Showing and info requests from your listing microsites</p>
        </div>
        {canExport
          ? <a href="/api/leads/export" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><Download className="w-4 h-4" /> Export CSV</a>
          : <Link href="/dashboard/billing" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-400"><Lock className="w-4 h-4" /> CSV export (Pro)</Link>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[['Total leads', total], ['Awaiting follow-up', fresh], ['Last 7 days', week]].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="font-display text-2xl font-bold text-slate-900">{value as number}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 text-sm">
        {[undefined, ...LEAD_STATUSES].map(s => (
          <Link key={s ?? 'all'} href={s ? `/dashboard/leads?status=${s}` : '/dashboard/leads'}
            className={`px-3 py-1.5 rounded-lg font-medium ${status === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No leads yet. Publish a listing microsite and share its link — requests land here and in your inbox.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(l => (
              <div key={l.id} className="p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{l.name}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[l.status]}`}>{l.status}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{l.kind === 'showing' ? 'Showing request' : 'Info request'}</span>
                  </div>
                  <div className="text-sm text-slate-600 mt-1 break-words">
                    <a className="text-amber-700 hover:underline" href={`mailto:${l.email}`}>{l.email}</a>
                    {l.phone && <> · <a className="text-amber-700 hover:underline" href={`tel:${l.phone}`}>{l.phone}</a></>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatListingAddress(l.listing) || 'Listing'}
                    {l.kind === 'showing' && (l.preferredDate || l.preferredTime) && <> · wants {[l.preferredDate, l.preferredTime ? TIME[l.preferredTime] : null].filter(Boolean).join(', ')}</>}
                    {' · '}via {l.source ?? 'direct'} · {l.createdAt.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET
                  </div>
                  {l.message && <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{l.message}</p>}
                  {(l.delivery?.email === 'failed' || l.delivery?.webhook === 'failed' || l.delivery?.sms === 'failed') && (
                    <p className="text-xs text-red-600 mt-2">Alert delivery failed ({[l.delivery?.email === 'failed' && 'email', l.delivery?.sms === 'failed' && 'SMS', l.delivery?.webhook === 'failed' && 'webhook'].filter(Boolean).join(', ')}). The lead is saved here.</p>
                  )}
                </div>
                <LeadActions id={l.id} status={l.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-display font-semibold text-slate-900 mb-4">Alert settings</h2>
        <LeadSettingsPanel />
      </div>

      <p className="text-xs text-slate-400">
        Tip: add <code>?utm_source=instagram</code> (or facebook, email…) to the microsite link you post, and each lead shows where it came from.
      </p>
    </div>
  )
}
