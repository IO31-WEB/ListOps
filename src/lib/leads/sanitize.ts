/** Pure helpers for the public lead form (no DB / network imports, so they are trivially unit-testable). */

export const oneLine = (s: string, max = 200) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/** Multi-line free text: strip control chars, normalise newlines, cap blank lines. */
export function cleanMessage(s: string, max = 2000): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/** Accepts common US formats and "+<country>" numbers. Returns E.164-ish string or null if it isn't a plausible phone. */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export const countUrls = (s: string) => (s.match(/https?:\/\/|www\./gi) ?? []).length

export interface BotSignals {
  website?: string      // honeypot — real users never see/fill it
  elapsedMs?: number    // ms between form render and submit
  message?: string
}

/** Returns a reason when the submission looks automated, else null. Callers pretend success so bots learn nothing. */
export function botReason(s: BotSignals): string | null {
  if (s.website && s.website.trim()) return 'honeypot'
  if (typeof s.elapsedMs === 'number' && s.elapsedMs < 1500) return 'too_fast'
  if (s.message && countUrls(s.message) > 2) return 'links'
  return null
}

/** Short source label from utm_source / ?src. Lower-case slug-ish, or null. */
export function cleanTag(s: string | undefined | null, max = 60): string | null {
  if (!s) return null
  const t = oneLine(s, max).toLowerCase().replace(/[^a-z0-9 _.\-+]/g, '')
  return t || null
}

/** Host only (never the full referrer URL, which can carry tokens). */
export function referrerHost(s: string | undefined | null): string | null {
  if (!s) return null
  try {
    return new URL(s).hostname.slice(0, 120) || null
  } catch {
    return null
  }
}

export const CONSENT_VERSION = 'v1'

export function consentText(agentName?: string | null): string {
  const who = agentName && agentName.trim() ? oneLine(agentName, 80) : 'the listing agent'
  return `I agree to be contacted by ${who} by email, phone or text about this property. Message and data rates may apply. Consent is not a condition of purchasing any property.`
}
