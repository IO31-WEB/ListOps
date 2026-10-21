/**
 * Central Resend wrapper — the ONLY place emails are sent from.
 *
 * Two kinds of mail:
 *  - 'transactional': something the recipient (or their colleague) asked for — invites, receipts,
 *    contact-form replies. Gets the postal-address footer, no unsubscribe link required.
 *  - 'marketing': any outreach / promotional / campaign mail. CAN-SPAM requirements are ENFORCED HERE,
 *    so a caller cannot forget them: the send is REFUSED unless a postal address is configured, the
 *    recipient is not on the suppression list, and every message gets a working one-click unsubscribe
 *    link (footer + List-Unsubscribe headers).
 *
 * Deliverability: send only from your verified domain, always include a plain-text part, set reply-to.
 */
import { Resend } from 'resend'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { emailSuppressions } from '@/lib/db/schema'
import { normalizeEmail, unsubscribeApiUrl, unsubscribePageUrl } from '@/lib/unsubscribe'

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

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Physical postal address required by CAN-SPAM, e.g. "ListOps LLC, 123 Main St, Suite 4, Austin, TX 78701". */
export const postalAddress = () => (process.env.MAIL_FOOTER_ADDRESS ?? '').trim()

export interface FooterParts { text: string; html: string }

/** Pure function (unit-tested). Marketing footers include the unsubscribe link; all footers include the address. */
export function buildFooter(opts: { kind: 'transactional' | 'marketing'; address: string; unsubscribeUrl?: string; reason?: string }): FooterParts {
  const lines: string[] = []
  if (opts.reason) lines.push(opts.reason)
  if (opts.kind === 'marketing' && opts.unsubscribeUrl) lines.push(`Unsubscribe: ${opts.unsubscribeUrl}`)
  if (opts.address) lines.push(opts.address)
  const text = `\n\n--\n${lines.join('\n')}`
  const htmlLines: string[] = []
  if (opts.reason) htmlLines.push(escapeHtml(opts.reason))
  if (opts.kind === 'marketing' && opts.unsubscribeUrl) {
    htmlLines.push(`<a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#64748b">Unsubscribe</a>`)
  }
  if (opts.address) htmlLines.push(escapeHtml(opts.address))
  const html = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 12px"/><p style="color:#94a3b8;font-size:12px;line-height:1.5;font-family:Arial,sans-serif">${htmlLines.join('<br/>')}</p>`
  return { text, html }
}

export interface SendArgs {
  /** Marketing mail must go to exactly one recipient per call (each gets a personal unsubscribe token). */
  to: string
  subject: string
  text: string
  html?: string
  kind?: 'transactional' | 'marketing'
  fromName?: string
  replyTo?: string
  /** Why the recipient is getting this (shown in the footer), e.g. "You received this because a colleague invited you." */
  reason?: string
  tags?: Array<{ name: string; value: string }>
}

export type SendResult = { ok: true } | { ok: false; reason: 'not_configured' | 'suppressed' | 'no_postal_address' | 'provider_error' }

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await db.query.emailSuppressions.findFirst({ where: eq(emailSuppressions.email, normalizeEmail(email)) })
  return !!row
}

export async function suppressEmail(email: string, reason = 'unsubscribe'): Promise<void> {
  await db.insert(emailSuppressions).values({ email: normalizeEmail(email), reason }).onConflictDoNothing()
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const c = getClient()
  if (!c) {
    console.error('[email] RESEND_API_KEY not configured — email not sent')
    return { ok: false, reason: 'not_configured' }
  }
  const kind = args.kind ?? 'transactional'
  const address = postalAddress()
  const headers: Record<string, string> = {}
  let footer: FooterParts

  if (kind === 'marketing') {
    // CAN-SPAM guard rails — refuse rather than send a non-compliant message.
    if (!address) {
      console.error('[email] MAIL_FOOTER_ADDRESS is not set — refusing to send marketing email (CAN-SPAM requires a postal address)')
      return { ok: false, reason: 'no_postal_address' }
    }
    if (await isSuppressed(args.to)) return { ok: false, reason: 'suppressed' }
    const pageUrl = unsubscribePageUrl(args.to)
    headers['List-Unsubscribe'] = `<${unsubscribeApiUrl(args.to)}>, <mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    footer = buildFooter({ kind, address, unsubscribeUrl: pageUrl, reason: args.reason })
  } else {
    footer = buildFooter({ kind, address, reason: args.reason })
  }

  const htmlBody = args.html ?? `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap">${escapeHtml(args.text)}</div>`

  const { error } = await c.emails.send({
    from: `${oneLine(args.fromName ?? 'ListOps', 60)} <${FROM_EMAIL}>`,
    to: args.to,
    subject: oneLine(args.subject, 150),
    text: args.text + footer.text,
    html: htmlBody + footer.html,
    reply_to: args.replyTo ?? SUPPORT_EMAIL,
    headers,
    tags: args.tags,
  })
  if (error) {
    console.error('[email] send failed:', error.name)
    return { ok: false, reason: 'provider_error' }
  }
  return { ok: true }
}
