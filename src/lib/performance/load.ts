import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignEvents, campaigns, leads } from '@/lib/db/schema'
import { dayKey, campaignAgeDays, fillDaily, groupSources, sum, type DayPoint, type EventKind, type SourceRow } from './stats'

export interface Performance {
  days: number
  /** all-time microsite view counter (includes views from before daily tracking began) */
  viewsAllTime: number
  /** first day we have daily data for, or null */
  trackingSince: string | null
  views: DayPoint[]
  viewsInWindow: number
  viewsLast7: number
  clicks: { call: number; email: number }
  downloads: { flyerPdf: number; kit: number }
  leads: { total: number; inWindow: number; showing: number; info: number; sources: SourceRow[] }
  campaignAgeDays: number
  published: boolean
}

/** Real, tracked numbers for one campaign. Nothing is estimated. The caller must already have authorised access. */
export async function loadPerformance(campaignId: string, days = 30): Promise<Performance | null> {
  const c = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    columns: { id: true, micrositeViews: true, micrositePublished: true, createdAt: true },
  })
  if (!c) return null

  const today = dayKey()
  const since = fillDaily([], days, today)[0].day
  const [events, firstDay, leadRows] = await Promise.all([
    db.select({ day: campaignEvents.day, kind: campaignEvents.kind, count: campaignEvents.count }).from(campaignEvents)
      .where(and(eq(campaignEvents.campaignId, campaignId), gte(campaignEvents.day, since))),
    db.select({ d: sql<string | null>`min(${campaignEvents.day})` }).from(campaignEvents).where(eq(campaignEvents.campaignId, campaignId)),
    db.select({ source: leads.source, kind: leads.kind, createdAt: leads.createdAt }).from(leads).where(eq(leads.campaignId, campaignId)),
  ])

  const of = (k: EventKind) => events.filter(e => e.kind === k)
  const views = fillDaily(of('view'), days, today)
  const windowStart = new Date(Date.now() - days * 86_400_000)
  return {
    days,
    viewsAllTime: c.micrositeViews ?? 0,
    trackingSince: firstDay[0]?.d ?? null,
    views,
    viewsInWindow: sum(views),
    viewsLast7: sum(views.slice(-7)),
    clicks: { call: sum(of('click_call')), email: sum(of('click_email')) },
    downloads: { flyerPdf: sum(of('flyer_pdf')), kit: sum(of('kit_download')) },
    leads: {
      total: leadRows.length,
      inWindow: leadRows.filter(l => l.createdAt >= windowStart).length,
      showing: leadRows.filter(l => l.kind === 'showing').length,
      info: leadRows.filter(l => l.kind === 'info').length,
      sources: groupSources(leadRows),
    },
    campaignAgeDays: campaignAgeDays(c.createdAt),
    published: c.micrositePublished,
  }
}
