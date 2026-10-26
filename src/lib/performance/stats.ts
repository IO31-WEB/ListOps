/** Pure helpers for listing performance. No DB, no network. */

export const APP_TZ = 'America/New_York'
export const EVENT_KINDS = ['view', 'click_call', 'click_email', 'flyer_pdf', 'kit_download', 'report_view'] as const
export type EventKind = (typeof EVENT_KINDS)[number]
/** Kinds the public microsite may report about itself. */
export const PUBLIC_EVENT_KINDS = ['click_call', 'click_email'] as const

/** YYYY-MM-DD for a moment, in the app timezone (so "today" matches what the agent sees). */
export function dayKey(d: Date = new Date(), tz: string = APP_TZ): string {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const g = (t: string) => p.find(x => x.type === t)!.value
  return `${g('year')}-${g('month')}-${g('day')}`
}

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|go-http|axios|node-fetch|java\//i

/** Crawlers, link-preview fetchers and monitors must not count as buyer views. Missing UA counts as a bot. */
export const isBotUserAgent = (ua: string | null | undefined): boolean => !ua || BOT_RE.test(ua)

export interface DayPoint { day: string; count: number }

/** Oldest → newest list of `days` calendar days ending at `endDay`, zero-filled. */
export function fillDaily(rows: Array<{ day: string; count: number }>, days: number, endDay: string): DayPoint[] {
  const byDay = new Map<string, number>()
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.count)
  const [y, m, d] = endDay.split('-').map(Number)
  const end = Date.UTC(y, m - 1, d)
  const out: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const t = new Date(end - i * 86_400_000)
    const key = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
    out.push({ day: key, count: byDay.get(key) ?? 0 })
  }
  return out
}

export const sum = (pts: Array<{ count: number }>) => pts.reduce((a, p) => a + p.count, 0)

export interface SourceRow { source: string; count: number }

/** Group leads by source label (null/blank → "direct"), biggest first. */
export function groupSources(leads: Array<{ source: string | null }>): SourceRow[] {
  const m = new Map<string, number>()
  for (const l of leads) { const k = l.source?.trim() || 'direct'; m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
}

/** Share with one decimal, or null when there is no denominator (we never show a made-up 0%). */
export const rate = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null)

export function campaignAgeDays(createdAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000))
}

/** Unguessable report token: 24 random bytes, base64url (32 chars). Accepts any 32-char url-safe token on read. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/
