/**
 * Central Resend wrapper. Deliverability rules baked in:
 *  - ALWAYS send from your verified domain (RESEND_FROM_EMAIL, e.g. hello@listops.io) —
 *    never from gmail/yahoo/etc. (DMARC will reject it).
 *  - Always include a plain-text part alongside HTML (spam filters penalize HTML-only).
 *  - Set reply_to to a monitored inbox so replies count as positive engagement.
 *  - Marketing / outreach mail carries List-Unsubscribe headers (Gmail/Yahoo bulk-sender rules).
 * DNS (SPF / DKIM / DMARC) is configured in your DNS provider — see MIGRATION_AND_SECURITY.md.
 */
import { Resend } from 'resend'

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'hello@listops.io'
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@listops.io'

let client: Resend | null = null
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

/** Prevent header injection: no CR/LF in anything that ends up in a header. */
export const oneLine = (s: string, max = 200) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max)

export interface SendArgs {
  to: string | string[]
  subject: string
  text: string
  html?: string
  fromName?: string
  replyTo?: string
  /** true for outreach/marketing mail -> adds List-Unsubscribe headers */
  bulk?: boolean
  tags?: Array<{ name: string; value: string }>
}

export async function sendEmail(args: SendArgs): Promise<{ ok: boolean }> {
  const c = getClient()
  if (!c) {
    console.error('[email] RESEND_API_KEY not configured — email not sent')
    return { ok: false }
  }
  const headers: Record<string, string> = {}
  if (args.bulk) {
    headers['List-Unsubscribe'] = `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  const { error } = await c.emails.send({
    from: `${oneLine(args.fromName ?? 'ListOps', 60)} <${FROM_EMAIL}>`,
    to: args.to,
    subject: oneLine(args.subject, 150),
    text: args.text,
    html: args.html,
    reply_to: args.replyTo ?? SUPPORT_EMAIL,
    headers,
    tags: args.tags,
  })
  if (error) {
    console.error('[email] send failed:', error.name)
    return { ok: false }
  }
  return { ok: true }
}
