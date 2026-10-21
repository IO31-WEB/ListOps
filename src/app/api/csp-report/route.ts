/**
 * POST /api/csp-report — receives Content-Security-Policy violation reports from browsers (report-uri).
 *
 * Public by necessity (browsers send these without cookies/auth), so it is defensive: tiny body cap, per-IP rate
 * limit, only whitelisted string fields kept, URLs stripped of query strings/fragments (they can carry tokens),
 * and de-duplicated so one broken page can't flood Sentry. Always answers 204.
 */
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitAPI } from '@/lib/ratelimit'
import { captureError } from '@/lib/monitoring'

const seen = new Map<string, number>()
const DEDUPE_MS = 10 * 60 * 1000

const clean = (v: unknown, max = 200): string => {
  if (typeof v !== 'string') return ''
  try {
    const u = new URL(v)
    return (u.origin + u.pathname).slice(0, max) // drop ?query and #fragment
  } catch {
    return v.replace(/[\r\n]+/g, ' ').slice(0, max) // e.g. "inline", "eval", "data"
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!(await rateLimitAPI(`csp:${ip}`)).success) return new NextResponse(null, { status: 204 })

    const len = Number(request.headers.get('content-length') ?? 0)
    if (len > 8 * 1024) return new NextResponse(null, { status: 204 })

    const raw = JSON.parse(await request.text()) as Record<string, unknown>
    // report-uri format: { "csp-report": {...} }; Reporting API format: [{ body: {...} }]
    const body = (Array.isArray(raw) ? (raw[0] as Record<string, unknown>)?.body : (raw['csp-report'] ?? raw)) as Record<string, unknown> | undefined
    if (!body) return new NextResponse(null, { status: 204 })

    const directive = String(body['violated-directive'] ?? body['effectiveDirective'] ?? body['effective-directive'] ?? '').slice(0, 60)
    const blocked = clean(body['blocked-uri'] ?? body['blockedURL'])
    const page = clean(body['document-uri'] ?? body['documentURL'])
    const key = `${directive}|${blocked}|${page}`

    const now = Date.now()
    if (now - (seen.get(key) ?? 0) < DEDUPE_MS) return new NextResponse(null, { status: 204 })
    if (seen.size > 500) seen.clear()
    seen.set(key, now)

    captureError(new Error(`CSP violation: ${directive} blocked ${blocked || '(inline/eval)'}`), {
      directive, blocked, page, disposition: String(body['disposition'] ?? '').slice(0, 20),
    })
  } catch {
    /* malformed report — ignore */
  }
  return new NextResponse(null, { status: 204 })
}
