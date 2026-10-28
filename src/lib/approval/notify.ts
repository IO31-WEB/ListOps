import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { approvalRequests, approvalResponses, campaigns, users } from '@/lib/db/schema'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/leads/html'
import { formatListingAddress } from '@/lib/address'
import { summarize } from './items'

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/+$/, '')

/** Tells the agent a seller answered. Never throws (runs in after()). */
export async function notifyAgentOfResponse(requestId: string): Promise<void> {
  try {
    const req = await db.query.approvalRequests.findFirst({ where: eq(approvalRequests.id, requestId) })
    if (!req) return
    const [agent, campaign, rows] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, req.agentId), columns: { email: true } }),
      db.query.campaigns.findFirst({ where: eq(campaigns.id, req.campaignId), with: { listing: true } }),
      db.select().from(approvalResponses).where(eq(approvalResponses.requestId, requestId)),
    ])
    if (!agent?.email) return
    const sum = summarize(req.items, rows)
    const address = formatListingAddress(campaign?.listing) || 'your listing'
    const signed = rows[0]?.signedName ?? 'Your seller'
    const comments = req.items.flatMap(i => { const r = rows.find(x => x.itemKey === i.key); return r?.decision === 'changes' ? [{ label: i.label, comment: r.comment ?? '' }] : [] })
    const headline = sum.status === 'approved' ? `${signed} approved everything for ${address}` : `${signed} requested changes on ${sum.changes} item${sum.changes === 1 ? '' : 's'} for ${address}`
    const link = `${appUrl()}/dashboard/campaigns/${req.campaignId}/approval`
    const text = `${headline}\n\n${sum.approved} approved · ${sum.changes} need changes\n\n${comments.map(c => `• ${c.label}: ${c.comment}`).join('\n')}\n\nReview: ${link}`
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a"><h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(headline)}</h2><p style="color:#64748b;margin:0 0 12px">${sum.approved} approved · ${sum.changes} need changes</p>${comments.map(c => `<div style="border-left:3px solid #f59e0b;padding:6px 12px;margin-bottom:8px"><strong>${escapeHtml(c.label)}</strong><br>${escapeHtml(c.comment)}</div>`).join('')}<p><a href="${link}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the approval</a></p></div>`
    await sendEmail({ to: agent.email, subject: headline.slice(0, 120), text, html, fromName: 'ListOps', reason: 'You sent a seller a ListOps approval link for this listing.', tags: [{ name: 'kind', value: 'seller_approval' }] })
  } catch (err) {
    console.error('[approval] notify failed', err)
  }
}
