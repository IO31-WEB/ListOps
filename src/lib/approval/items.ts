import { extractPosts, CHANNEL_LABEL, type Channel } from '@/lib/social/plan'

export const GROUPS = ['listing', 'social', 'email'] as const
export type Group = (typeof GROUPS)[number]
export interface ApprovalItem { key: string; group: Group; label: string; text: string }
export const GROUP_LABEL: Record<Group, string> = { listing: 'Listing description', social: 'Social media posts', email: 'Email' }

const MAX_TEXT = 6000
const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXT) : '')

interface CampaignLike {
  listing?: { description?: string | null } | null
  emailJustListed?: string | null
  facebookPosts?: Array<{ week?: number; copy?: string; hashtags?: string[] }> | null
  instagramPosts?: Array<{ week?: number; caption?: string; hashtags?: string[] }> | null
  analytics?: { listingCopy?: { headline?: string; fullDescription?: string }; linkedin?: Array<{ week?: number; post?: string; hashtags?: string[] }> } | null
}

/** Everything the seller can be asked to approve, for the chosen groups. Empty text is skipped. Keys are stable per item. */
export function buildApprovalItems(c: CampaignLike, groups: readonly Group[] = GROUPS): ApprovalItem[] {
  const out: ApprovalItem[] = []
  const add = (key: string, group: Group, label: string, text: unknown) => { const t = clean(text); if (groups.includes(group) && t) out.push({ key, group, label, text: t }) }
  const lc = c.analytics?.listingCopy
  add('headline', 'listing', 'Headline', lc?.headline)
  add('description', 'listing', 'Listing description', lc?.fullDescription || c.listing?.description)
  for (const p of extractPosts(c, ['facebook', 'instagram', 'linkedin'] as Channel[])) {
    add(p.sourceKey, 'social', `${CHANNEL_LABEL[p.channel]}${p.week ? ` · week ${p.week}` : ''}`, p.body)
  }
  add('email_just_listed', 'email', '"Just Listed" email', c.emailJustListed)
  return out
}

export type Decision = 'approved' | 'changes'
export interface ResponseRow { itemKey: string; decision: Decision; comment: string | null }
export interface Summary { total: number; approved: number; changes: number; pending: number; status: 'pending' | 'in_progress' | 'approved' | 'changes_requested' }

/** Only responses for keys that exist in the snapshot count. "approved" requires every item approved. */
export function summarize(items: Array<{ key: string }>, responses: ResponseRow[]): Summary {
  const keys = new Set(items.map(i => i.key))
  const latest = new Map<string, ResponseRow>()
  for (const r of responses) if (keys.has(r.itemKey)) latest.set(r.itemKey, r)
  const approved = [...latest.values()].filter(r => r.decision === 'approved').length
  const changes = [...latest.values()].filter(r => r.decision === 'changes').length
  const total = items.length
  const pending = total - approved - changes
  const status = total === 0 || latest.size === 0 ? 'pending' : changes > 0 ? 'changes_requested' : pending === 0 ? 'approved' : 'in_progress'
  return { total, approved, changes, pending, status }
}

/** Validates a seller submission against the snapshot: every item answered once, no unknown keys, comments where changes are requested. */
export function validateSubmission(items: Array<{ key: string }>, responses: Array<{ key: string; decision: Decision; comment?: string }>): string | null {
  const keys = new Set(items.map(i => i.key))
  const seen = new Set<string>()
  for (const r of responses) {
    if (!keys.has(r.key)) return 'One of the items is no longer part of this request.'
    if (seen.has(r.key)) return 'Duplicate answers.'
    seen.add(r.key)
    if (r.decision === 'changes' && !(r.comment ?? '').trim()) return 'Please say what to change for each item you did not approve.'
  }
  if (seen.size !== keys.size) return 'Please answer every item.'
  return null
}
