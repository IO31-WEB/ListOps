/**
 * Address normalization — one implementation, used on SAVE (listing-schemas, server-side) and on DISPLAY
 * (so rows saved before this existed also render correctly). All functions are idempotent and pure.
 *
 *   "136 sharp lane"           -> "136 Sharp Lane"
 *   "136 SHARP LANE, elizabethton, tn" -> "136 Sharp Lane, Elizabethton, TN"
 *   "1200 n main st apt 4b"    -> "1200 N Main St Apt 4B"
 *   "42nd ave ne"              -> "42nd Ave NE"
 *   "o'brien rd" / "mcdonald dr" -> "O'Brien Rd" / "McDonald Dr"
 */

const STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO',
  'MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
])

/** Tokens that are always upper-case in a US street address. */
const UPPER = new Set(['NE', 'NW', 'SE', 'SW', 'PO', 'US', 'SR', 'CR', 'FM', 'RR', 'HC', 'USA'])
/** Lower-case small words (only when not the first token). */
const SMALL = new Set(['of', 'and', 'the', 'at', 'de', 'la'])

function capWord(w: string, first: boolean): string {
  const lower = w.toLowerCase()
  const upper = w.toUpperCase()
  if (UPPER.has(upper)) return upper
  if (!first && SMALL.has(lower)) return lower
  // 1st 2nd 3rd 42nd -> lower-case ordinal suffix
  if (/^\d+(st|nd|rd|th)$/i.test(w)) return lower
  // 4b, 12c (unit numbers/letters) -> 4B, 12C
  if (/^\d+[a-z]$/i.test(w)) return upper
  // #4b -> #4B
  if (w.startsWith('#')) return '#' + capWord(w.slice(1), true)
  // hyphenated: capitalize each part (Winston-Salem, I-75)
  if (w.includes('-')) return w.split('-').map(p => capWord(p, true)).join('-')
  // O'Brien / D'Angelo (single letter before the apostrophe), but "Mike's" stays "Mike's"
  const ap = w.indexOf("'")
  if (ap > 0) {
    const head = w.slice(0, ap)
    const tail = w.slice(ap + 1)
    return head.length === 1
      ? head.toUpperCase() + "'" + (tail ? tail[0].toUpperCase() + tail.slice(1).toLowerCase() : '')
      : head[0].toUpperCase() + head.slice(1).toLowerCase() + "'" + tail.toLowerCase()
  }
  // McDonald (not Mc itself, not "Mcallen"-style short words)
  if (/^mc[a-z]{3,}$/i.test(w)) return 'Mc' + lower[2].toUpperCase() + lower.slice(3)
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Title-case a free-text street/city string. Comma-separated 2-letter state segments stay upper-case. */
export function titleCaseAddress(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/\s+/g, ' ')
    .trim()
    .split(',')
    .map(seg => {
      const t = seg.trim()
      if (STATES.has(t.toUpperCase()) && t.length === 2) return t.toUpperCase()
      return t.split(' ').filter(Boolean).map((w, i) => capWord(w, i === 0)).join(' ')
    })
    .filter(Boolean)
    .join(', ')
}

export const formatStreet = titleCaseAddress
export const formatCity = titleCaseAddress

export function formatState(input: string | null | undefined): string {
  return (input ?? '').trim().toUpperCase()
}

/** "136 Sharp Lane, Elizabethton, TN" from raw (possibly un-normalized) listing fields. */
export function formatListingAddress(l: { address?: string | null; city?: string | null; state?: string | null } | null | undefined): string {
  if (!l) return ''
  return [formatStreet(l.address), formatCity(l.city), formatState(l.state)].filter(Boolean).join(', ')
}

/** Returns a copy of a listing-shaped object with address/city/state normalized (null/undefined pass through). */
export function normalizeListing<T extends { address?: string | null; city?: string | null; state?: string | null }>(l: T): T
export function normalizeListing<T extends { address?: string | null; city?: string | null; state?: string | null }>(l: T | null | undefined): T | null | undefined
export function normalizeListing<T extends { address?: string | null; city?: string | null; state?: string | null }>(l: T | null | undefined) {
  if (!l) return l
  const out = { ...l }
  if ('address' in out) out.address = (l.address == null ? l.address : formatStreet(l.address)) as T['address']
  if ('city' in out) out.city = (l.city == null ? l.city : formatCity(l.city)) as T['city']
  if ('state' in out) out.state = (l.state == null ? l.state : formatState(l.state)) as T['state']
  return out
}
