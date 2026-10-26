import { csvRow } from '@/lib/leads/csv'
import { CHANNEL_LABEL, type Channel } from './plan'
import { localParts } from './time'

export interface ExportPost { id: string; channel: Channel; status: string; body: string; scheduledFor: Date; property: string; imageUrl: string | null; link: string | null }

export function postsToCsv(posts: ExportPost[], tz: string): string {
  const lines = [csvRow(['Channel', 'Scheduled (local date)', 'Scheduled (local time)', 'Scheduled (UTC)', 'Status', 'Text', 'Image URL', 'Link', 'Property'])]
  for (const p of posts) {
    const l = localParts(p.scheduledFor, tz)
    lines.push(csvRow([CHANNEL_LABEL[p.channel], l.date, l.time, p.scheduledFor.toISOString(), p.status, p.body, p.imageUrl, p.link, p.property]))
  }
  return lines.join('\r\n') + '\r\n'
}

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

/** RFC 5545 line folding at 75 octets (continuation lines start with a space). */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74
    if (enc.encode(cur + ch).length > limit) { out.push(cur); cur = ch } else cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** Calendar file: one 30-minute event per post with a 15-minute alert, so due posts show up in the agent's own calendar. */
export function postsToIcs(posts: ExportPost[], now: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ListOps//Social Queue//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const p of posts) {
    lines.push(
      'BEGIN:VEVENT', `UID:${p.id}@listops.io`, `DTSTAMP:${icsStamp(now)}`,
      `DTSTART:${icsStamp(p.scheduledFor)}`, `DTEND:${icsStamp(new Date(p.scheduledFor.getTime() + 30 * 60_000))}`,
      `SUMMARY:${icsEscape(`Post to ${CHANNEL_LABEL[p.channel]}: ${p.property}`)}`,
      `DESCRIPTION:${icsEscape(p.body.slice(0, 1500))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Social post due', 'TRIGGER:-PT15M', 'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
