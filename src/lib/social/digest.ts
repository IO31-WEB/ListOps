/**
 * Daily "posts due" email. Called from /api/cron/daily (one email per agent). Includes every scheduled post due within
 * the next 24 h (or already past due) that has not been reminded about; marks them reminded so nobody is emailed twice.
 */
import { and, eq, inArray, isNull, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { socialPosts, socialSettings, users } from '@/lib/db/schema'
import { sendEmail } from '@/lib/email'
import { canAccess, type PlanTier } from '@/lib/plans'
import { escapeHtml } from '@/lib/leads/html'
import { formatListingAddress } from '@/lib/address'
import { CHANNEL_LABEL } from './plan'
import { isValidTimeZone, localParts } from './time'

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/+$/, '')

export async function sendSocialDigests(now: Date = new Date()): Promise<{ agents: number; posts: number; failed: number }> {
  const due = await db.query.socialPosts.findMany({
    where: and(eq(socialPosts.status, 'scheduled'), isNull(socialPosts.reminderSentAt), lte(socialPosts.scheduledFor, new Date(now.getTime() + 24 * 3_600_000))),
    with: { campaign: { with: { listing: true } } },
    limit: 1000,
  })
  const byAgent = new Map<string, typeof due>()
  for (const p of due) byAgent.set(p.agentId, [...(byAgent.get(p.agentId) ?? []), p])
  if (byAgent.size === 0) return { agents: 0, posts: 0, failed: 0 }

  const ids = [...byAgent.keys()]
  const [agents, settings] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.id, ids), columns: { id: true, email: true, timezone: true, deletedAt: true }, with: { organization: { with: { subscriptions: true } } } }),
    db.query.socialSettings.findMany({ where: inArray(socialSettings.userId, ids) }),
  ])
  const digestOff = new Set(settings.filter(s => !s.digest).map(s => s.userId))

  let sentAgents = 0, sentPosts = 0, failed = 0
  for (const a of agents) {
    const posts = byAgent.get(a.id) ?? []
    const plan = (a.organization?.subscriptions?.[0]?.plan ?? 'free') as PlanTier
    // Opted out / closed / downgraded: leave the posts in the queue but don't email.
    if (a.deletedAt || digestOff.has(a.id) || !canAccess(plan, 'social_scheduling')) continue
    const tz = isValidTimeZone(a.timezone) ? a.timezone : 'America/New_York'
    const lines = posts.sort((x, y) => x.scheduledFor.getTime() - y.scheduledFor.getTime()).map(p => {
      const l = localParts(p.scheduledFor, tz)
      return { when: `${l.date} ${l.time}`, ch: CHANNEL_LABEL[p.channel], prop: formatListingAddress(p.campaign?.listing) || 'Listing', body: p.body }
    })
    const text = `You have ${lines.length} social post${lines.length === 1 ? '' : 's'} due (times in ${tz}):\n\n${lines.map(l => `${l.when} — ${l.ch} — ${l.prop}\n${l.body.slice(0, 700)}`).join('\n\n---\n\n')}\n\nOpen your calendar to copy, edit or mark posts as posted: ${appUrl()}/dashboard/social\nTurn this email off on that page.`
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a"><h2 style="margin:0 0 12px;font-size:18px">${lines.length} social post${lines.length === 1 ? '' : 's'} due</h2>${lines.map(l => `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:12px"><div style="color:#64748b;font-size:13px">${escapeHtml(l.when)} · <strong>${escapeHtml(l.ch)}</strong> · ${escapeHtml(l.prop)}</div><div style="white-space:pre-wrap;margin-top:6px">${escapeHtml(l.body.slice(0, 700))}</div></div>`).join('')}<p><a href="${appUrl()}/dashboard/social" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open social calendar</a></p></div>`
    const r = await sendEmail({ to: a.email, subject: `${lines.length} social post${lines.length === 1 ? '' : 's'} due today`, text, html, fromName: 'ListOps', reason: 'You get this daily reminder when posts in your ListOps social calendar are due. You can turn it off in the calendar.', tags: [{ name: 'kind', value: 'social_digest' }] })
    if (r.ok) {
      await db.update(socialPosts).set({ reminderSentAt: now }).where(inArray(socialPosts.id, posts.map(p => p.id)))
      sentAgents++; sentPosts += posts.length
    } else failed++
  }
  return { agents: sentAgents, posts: sentPosts, failed }
}
