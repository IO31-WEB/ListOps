/** Builds the agent notification (email + SMS text). Pure, unit-tested. */
import { escapeHtml, oneLine } from './html'

export interface LeadMessageArgs {
  kind: 'showing' | 'info'
  name: string; email: string; phone: string | null; message: string | null
  preferredDate: string | null; preferredTime: string | null
  address: string; source: string | null; dashboardUrl: string
}

const timeLabel: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', anytime: 'Anytime' }

export function buildLeadEmail(a: LeadMessageArgs): { subject: string; text: string; html: string } {
  const what = a.kind === 'showing' ? 'Showing request' : 'Info request'
  const subject = oneLine(`New ${what.toLowerCase()}: ${a.address}`, 140)
  const when = a.kind === 'showing' && (a.preferredDate || a.preferredTime)
    ? [a.preferredDate, a.preferredTime ? timeLabel[a.preferredTime] ?? a.preferredTime : null].filter(Boolean).join(' · ')
    : null
  const rows: Array<[string, string]> = [
    ['Name', a.name], ['Email', a.email], ['Phone', a.phone ?? '—'], ['Property', a.address],
  ]
  if (when) rows.push(['Preferred time', when])
  rows.push(['Came from', a.source ?? 'direct'])

  const text = `${what} for ${a.address}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}${a.message ? `\n\nMessage:\n${a.message}` : ''}\n\nReply to this email to answer ${a.name} directly.\nAll leads: ${a.dashboardUrl}`
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">
<h2 style="margin:0 0 4px;font-size:18px">${escapeHtml(what)} — ${escapeHtml(a.address)}</h2>
<p style="margin:0 0 16px;color:#64748b">Reply to this email to answer ${escapeHtml(a.name)} directly.</p>
<table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#64748b">${escapeHtml(k)}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join('')}</table>
${a.message ? `<p style="margin:16px 0 4px;color:#64748b">Message</p><div style="white-space:pre-wrap;background:#f8fafc;border-radius:8px;padding:12px">${escapeHtml(a.message)}</div>` : ''}
<p style="margin-top:20px"><a href="${escapeHtml(a.dashboardUrl)}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open leads inbox</a></p>
</div>`
  return { subject, text, html }
}

export function buildLeadSms(a: Pick<LeadMessageArgs, 'kind' | 'name' | 'phone' | 'email' | 'address'>): string {
  const what = a.kind === 'showing' ? 'showing request' : 'info request'
  return `ListOps: new ${what} for ${a.address} from ${oneLine(a.name, 40)} (${a.phone ?? a.email}). Details in your leads inbox.`.slice(0, 300)
}
