/** Time-zone math without a date library. Pure. */

const parts = (d: Date, tz: string) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d)
  const g = (t: string) => Number(p.find(x => x.type === t)!.value)
  return { y: g('year'), m: g('month'), d: g('day'), hh: g('hour'), mm: g('minute'), ss: g('second') }
}

/** Offset (ms) of `tz` from UTC at that instant. */
function offsetMs(at: Date, tz: string): number {
  const p = parts(at, tz)
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - (at.getTime() - at.getMilliseconds())
}

export const isValidTimeZone = (tz: string): boolean => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false } }

/** Wall-clock date ('YYYY-MM-DD') + time ('HH:mm') in `tz` → the UTC instant. Handles DST (two passes). */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - offsetMs(new Date(guess), tz)
  return new Date(guess - offsetMs(new Date(first), tz))
}

/** The wall-clock date/time of an instant in `tz`. */
export function localParts(d: Date, tz: string): { date: string; time: string } {
  const p = parts(d, tz)
  const two = (n: number) => String(n).padStart(2, '0')
  return { date: `${p.y}-${two(p.m)}-${two(p.d)}`, time: `${two(p.hh)}:${two(p.mm)}` }
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s)
