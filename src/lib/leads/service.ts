/**
 * Lead delivery: email + (optional) SMS + (optional) signed webhook, each gated by the OWNER's plan and each
 * isolated so one failing channel never blocks the others. The lead row is already saved before this runs, so a
 * delivery failure can never lose a lead — it is recorded in leads.delivery and visible in the dashboard.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leads, leadSettings } from '@/lib/db/schema'
import { sendEmail } from '@/lib/email'
import { formatListingAddress } from '@/lib/address'
import { canAccess } from '@/lib/plans'
import { getPlanTierForUserId } from '@/lib/user-service'
import { captureError } from '@/lib/monitoring'
import { buildLeadEmail, buildLeadSms } from './message'
import { deliverWebhook, type LeadWebhookPayload } from './webhook'
import { sendSms, smsConfigured } from './sms'

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/+$/, '')

type Status = 'sent' | 'failed' | 'skipped'

export async function deliverLead(leadId: string): Promise<void> {
  try {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { campaign: { with: { listing: true, brandKit: true, agent: true } } },
    })
    if (!lead || !lead.campaign) return
    const { campaign } = lead
    const agent = campaign.agent
    const bk = campaign.brandKit
    const [plan, settings] = await Promise.all([
      getPlanTierForUserId(lead.agentId),
      db.query.leadSettings.findFirst({ where: eq(leadSettings.userId, lead.agentId) }),
    ])

    const address = formatListingAddress(campaign.listing) || 'your listing'
    const micrositeUrl = campaign.micrositeSlug ? `${appUrl()}/l/${campaign.micrositeSlug}` : null
    const delivery: { email: Status; sms: Status; webhook: Status } = { email: 'skipped', sms: 'skipped', webhook: 'skipped' }

    // 1. Email (every plan that has lead capture)
    const to = settings?.notifyEmail || bk?.agentEmail || agent?.email
    if (to) {
      const m = buildLeadEmail({
        kind: lead.kind, name: lead.name, email: lead.email, phone: lead.phone, message: lead.message,
        preferredDate: lead.preferredDate, preferredTime: lead.preferredTime, address, source: lead.source,
        dashboardUrl: `${appUrl()}/dashboard/leads`,
      })
      const r = await sendEmail({
        to, subject: m.subject, text: m.text, html: m.html, replyTo: lead.email,
        fromName: 'ListOps Leads', reason: 'You received this because someone submitted a form on your listing microsite.',
        tags: [{ name: 'kind', value: 'lead_alert' }],
      })
      delivery.email = r.ok ? 'sent' : 'failed'
    }

    // 2. SMS to the agent's own number (Pro+, only when Twilio is configured and the agent opted in)
    if (settings?.smsEnabled && settings.smsPhone && canAccess(plan, 'lead_sms') && smsConfigured()) {
      delivery.sms = (await sendSms(settings.smsPhone, buildLeadSms({ kind: lead.kind, name: lead.name, phone: lead.phone, email: lead.email, address }))) ? 'sent' : 'failed'
    }

    // 3. Signed webhook (Pro+)
    if (settings?.webhookUrl && settings.webhookSecret && canAccess(plan, 'lead_webhook')) {
      const payload = buildWebhookPayload(lead, address, micrositeUrl, campaign.listing?.price ?? null)
      const r = await deliverWebhook({ url: settings.webhookUrl, secret: settings.webhookSecret, payload })
      delivery.webhook = r.ok ? 'sent' : 'failed'
    }

    await db.update(leads).set({ delivery }).where(eq(leads.id, leadId))
  } catch (err) {
    captureError(err, { route: 'leads/deliver', leadId })
  }
}

export function buildWebhookPayload(
  lead: typeof leads.$inferSelect, address: string, micrositeUrl: string | null, price: number | string | null,
  event: LeadWebhookPayload['event'] = 'lead.created',
): LeadWebhookPayload {
  return {
    event, id: lead.id, createdAt: lead.createdAt.toISOString(), type: lead.kind, name: lead.name, email: lead.email,
    phone: lead.phone, message: lead.message, preferredDate: lead.preferredDate, preferredTime: lead.preferredTime,
    consent: { given: true, text: lead.consentText, at: lead.consentAt.toISOString() },
    source: { source: lead.source, medium: lead.medium, campaign: lead.campaignTag, referrerHost: lead.referrerHost },
    property: { address, price: price == null ? null : Number(price), micrositeUrl },
    campaignId: lead.campaignId,
  }
}
