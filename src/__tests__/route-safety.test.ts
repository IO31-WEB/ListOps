/**
 * Static guard-rails over EVERY API route file. These encode the production-readiness rules so a future route can't
 * silently break them. If this fails, fix the route (or, for a genuinely-public endpoint, add it to PUBLIC with a reason).
 */
import { describe, test, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const API_DIR = join(process.cwd(), 'src/app/api')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : f === 'route.ts' ? [p] : []
  })
}
const routes = walk(API_DIR).map(p => ({ path: relative(API_DIR, p), src: readFileSync(p, 'utf8') }))

// Routes that are intentionally callable without a Clerk session, and how they are protected instead.
const PUBLIC: Record<string, string> = {
  'photos/[...key]/route.ts': 'public listing photos; strict key-shape validation, random unguessable keys',
  'l/[slug]/lead/route.ts': 'public microsite form: honeypot, min-fill-time, per-IP + per-listing rate limits, consent, owner plan gate',
  'l/[slug]/event/route.ts': 'public microsite click counter: 2 allowed kinds, bot filter, per-IP + per-listing rate limits, stores a counter only',
  'a/[token]/respond/route.ts': 'public seller approval submit: 192-bit revocable token, per-IP + per-token rate limits, zod-validated against the stored snapshot, plan gate',
  'contact/route.ts': 'honeypot + per-IP rate limit',
  'unsubscribe/route.ts': 'HMAC-signed token',
  'csp-report/route.ts': 'browser reports; rate-limited, size-capped',
  'webhooks/stripe/route.ts': 'Stripe signature',
  'webhooks/clerk/route.ts': 'Svix signature',
  'cron/daily/route.ts': 'CRON_SECRET', 'cron/cleanup-uploads/route.ts': 'CRON_SECRET',
  'cron/retention/route.ts': 'CRON_SECRET', 'cron/send-outreach/route.ts': 'CRON_SECRET',
}

describe('API route guard-rails', () => {
  test('found routes to check', () => expect(routes.length).toBeGreaterThan(30))

  test('every route authenticates (Clerk / admin) or is on the documented PUBLIC list', () => {
    const bad = routes.filter(r => !PUBLIC[r.path] && !/auth\(\)|requireUserId\(|requireAdminApi\(|getTeamAdminContext\(|currentDbUserId\(/.test(r.src)).map(r => r.path)
    expect(bad).toEqual([])
  })

  test('no route returns raw error text / stack traces to the client', () => {
    const leaks = routes.filter(r => /error:\s*(?:err|e|error)(?:or)?\??\.(?:message|stack)|error:\s*String\((?:err|e|error)\)|\.stack\b.*NextResponse|NextResponse\.json\(\{[^}]*\$\{(?:err|e|error)\??\.message/.test(r.src)).map(r => r.path)
    expect(leaks).toEqual([])
  })

  test('every route that calls Claude is rate-limited AND spend-capped', () => {
    const bad = routes.filter(r => /messages\.create\(/.test(r.src) && !/guardAi\(|rateLimitGenerate\(/.test(r.src)).map(r => r.path)
    expect(bad).toEqual([])
  })

  test('every route that reads a JSON body validates it with zod (or readJson+parse)', () => {
    const bad = routes.filter(r => /\.json\(\)/.test(r.src.replace(/await (res|response)\.json\(\)/g, '')) && /(?:req|request)\.json\(\)/.test(r.src) && !/\.parse\(|\.safeParse\(/.test(r.src)).map(r => r.path)
    expect(bad).toEqual([])
  })

  test('admin routes check admin identity AND same-origin', () => {
    const admin = routes.filter(r => r.path.startsWith('admin/'))
    expect(admin.length).toBeGreaterThan(0)
    for (const r of admin) {
      expect(r.src, r.path).toMatch(/requireAdminApi\(/)
      if (/export async function (POST|PUT|PATCH|DELETE)/.test(r.src)) expect(r.src, r.path).toMatch(/assertSameOrigin\(/)
    }
  })

  test('routes that sit behind the 18+ gate and spend money/content reject unconfirmed accounts', () => {
    for (const p of ['generate/route.ts', 'listings/route.ts', 'uploads/listing-photo/route.ts', 'billing/create-checkout/route.ts', 'campaigns/[id]/outreach/route.ts', 'referral/redeem/route.ts']) {
      expect(routes.find(r => r.path === p)?.src, p).toMatch(/assertAdult\(/)
    }
  })

  test('uploads identify files by magic bytes (never the client-declared type) and never accept SVG', () => {
    for (const p of ['uploads/listing-photo/route.ts', 'brand-kit/upload/route.ts']) {
      const src = routes.find(r => r.path === p)!.src
      expect(src, p).toMatch(/sniffImage\(/)
      expect(src, p).not.toMatch(/image\/svg/)
    }
  })

  test('Stripe webhook de-duplicates events and checkout uses an idempotency key', () => {
    expect(routes.find(r => r.path === 'webhooks/stripe/route.ts')!.src).toMatch(/stripeEvents/)
    expect(routes.find(r => r.path === 'billing/create-checkout/route.ts')!.src).toMatch(/idempotencyKey/)
  })

  test('EVERY Claude call site (routes and libs) carries the prompt-injection system prompt', () => {
    const files: Array<[string, string]> = []
    const walkAll = (d: string) => readdirSync(d).forEach(f => {
      const p = join(d, f)
      if (statSync(p).isDirectory()) { if (f !== '__tests__') walkAll(p) }
      else if (/\.tsx?$/.test(f)) files.push([relative(process.cwd(), p), readFileSync(p, 'utf8')])
    })
    walkAll(join(process.cwd(), 'src'))
    const withCalls = files.filter(([, src]) => /messages\.create\(/.test(src))
    expect(withCalls.length).toBeGreaterThanOrEqual(10)
    for (const [path, src] of withCalls) {
      const calls = (src.match(/messages\.create\(/g) ?? []).length
      const guarded = (src.match(/system:[^\n]*INJECTION_GUARD/g) ?? []).length
      expect(guarded, path).toBeGreaterThanOrEqual(calls)
    }
  })
})
