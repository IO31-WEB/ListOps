/** Turns a campaign's generated posts into a dated queue. Pure. Slots are SUGGESTED DEFAULTS, not claims about best times. */
import { addDays, zonedToUtc } from './time'

export const CHANNELS = ['facebook', 'instagram', 'linkedin'] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABEL: Record<Channel, string> = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn' }
export const CHANNEL_URL: Record<Channel, string> = { facebook: 'https://www.facebook.com/', instagram: 'https://www.instagram.com/', linkedin: 'https://www.linkedin.com/feed/' }

/** Day offset inside the campaign week + local time, per channel. Spread across the week so posts don't pile up. */
export const SLOTS: Record<Channel, { day: number; time: string }> = {
  facebook: { day: 0, time: '10:00' },
  instagram: { day: 1, time: '12:00' },
  linkedin: { day: 2, time: '09:00' },
}

export interface PlannableSource { sourceKey: string; channel: Channel; week: number | null; body: string }
export interface PlannedPost extends PlannableSource { scheduledFor: Date }

export function planSchedule(startDate: string, tz: string, sources: PlannableSource[]): PlannedPost[] {
  const seen = new Map<string, number>()
  return sources.map((s, i) => {
    const week = s.week && s.week > 0 ? s.week : i + 1
    const k = `${s.channel}:${week}`
    const n = seen.get(k) ?? 0
    seen.set(k, n + 1) // a second post for the same channel+week is pushed back a day so it doesn't collide
    const slot = SLOTS[s.channel]
    const date = addDays(startDate, (week - 1) * 7 + slot.day + n)
    return { ...s, scheduledFor: zonedToUtc(date, slot.time, tz) }
  })
}

const normTag = (t: string) => (t.startsWith('#') ? t : `#${t}`).replace(/\s+/g, '')

/** Copy + hashtags as one postable string (hashtags not already in the copy are appended). */
export function composeBody(copy: string, hashtags?: unknown): string {
  const text = (copy ?? '').trim()
  const tags = Array.isArray(hashtags) ? hashtags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map(normTag) : []
  const missing = tags.filter(t => !text.toLowerCase().includes(t.toLowerCase()))
  return missing.length ? `${text}\n\n${missing.join(' ')}` : text
}

interface CampaignLike {
  facebookPosts?: Array<{ week?: number; copy?: string; hashtags?: string[] }> | null
  instagramPosts?: Array<{ week?: number; caption?: string; hashtags?: string[] }> | null
  analytics?: { linkedin?: Array<{ week?: number; post?: string; hashtags?: string[] }> } | null
}

/** Postable items from a campaign. TikTok/Stories/X threads need video or multi-part posting, so they are not queued. */
export function extractPosts(c: CampaignLike, channels: readonly Channel[] = CHANNELS): PlannableSource[] {
  const out: PlannableSource[] = []
  const add = (channel: Channel, key: string, week: number | undefined, body: string) => {
    if (channels.includes(channel) && body.trim()) out.push({ sourceKey: key, channel, week: typeof week === 'number' ? week : null, body })
  }
  ;(c.facebookPosts ?? []).forEach((p, i) => add('facebook', `facebookPosts:${i}`, p.week, composeBody(p.copy ?? '', p.hashtags)))
  ;(c.instagramPosts ?? []).forEach((p, i) => add('instagram', `instagramPosts:${i}`, p.week, composeBody(p.caption ?? '', p.hashtags)))
  ;(c.analytics?.linkedin ?? []).forEach((p, i) => add('linkedin', `linkedin:${i}`, p.week, composeBody(p.post ?? '', p.hashtags)))
  return out
}

export const LIMITS: Record<Channel, number> = { facebook: 63206, instagram: 2200, linkedin: 3000 }

/** A human warning when the text won't fit the network's limits, else null. */
export function lengthIssue(channel: Channel, body: string): string | null {
  if (body.length > LIMITS[channel]) return `${CHANNEL_LABEL[channel]} allows ${LIMITS[channel].toLocaleString()} characters; this is ${body.length.toLocaleString()}.`
  if (channel === 'instagram' && (body.match(/#\w+/g) ?? []).length > 30) return 'Instagram allows at most 30 hashtags per post.'
  return null
}

export type DerivedStatus = 'draft' | 'scheduled' | 'due' | 'overdue' | 'posted' | 'skipped'

/** "Due" = scheduled for today or earlier and not yet marked posted; "overdue" = more than 24 h past. */
export function derivedStatus(status: string, scheduledFor: Date, now: Date = new Date()): DerivedStatus {
  if (status !== 'scheduled') return status as DerivedStatus
  const ms = now.getTime() - scheduledFor.getTime()
  if (ms > 24 * 3_600_000) return 'overdue'
  return ms >= 0 ? 'due' : 'scheduled'
}
