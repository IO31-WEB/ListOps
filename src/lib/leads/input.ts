import { z } from 'zod'
import { cleanMessage, cleanTag, normalizePhone, oneLine, referrerHost } from './sanitize'

export const LEAD_KINDS = ['showing', 'info'] as const
export type LeadKind = (typeof LEAD_KINDS)[number]
export const LEAD_STATUSES = ['new', 'contacted', 'closed'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export const PREFERRED_TIMES = ['morning', 'afternoon', 'evening', 'anytime'] as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
})

/** Body of the public POST /api/l/[slug]/lead. Strict: unknown keys are dropped, every string is capped. */
export const LeadInput = z.object({
  kind: z.enum(LEAD_KINDS),
  name: z.string().transform(s => oneLine(s, 100)).pipe(z.string().min(1)),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().max(40).optional().transform(v => normalizePhone(v)),
  message: z.string().max(4000).optional().transform(v => (v ? cleanMessage(v, 2000) : null)),
  preferredDate: isoDate.optional(),
  preferredTime: z.enum(PREFERRED_TIMES).optional(),
  consent: z.literal(true),
  // anti-spam
  website: z.string().max(200).optional(),
  elapsedMs: z.number().finite().optional(),
  // source tracking (read from the visitor's URL / referrer by the form)
  source: z.string().max(100).optional().transform(v => cleanTag(v)),
  medium: z.string().max(100).optional().transform(v => cleanTag(v)),
  campaignTag: z.string().max(100).optional().transform(v => cleanTag(v, 80)),
  referrer: z.string().max(500).optional().transform(v => referrerHost(v)),
})
export type LeadInputT = z.infer<typeof LeadInput>

export const LeadStatusPatch = z.object({ status: z.enum(LEAD_STATUSES) })
