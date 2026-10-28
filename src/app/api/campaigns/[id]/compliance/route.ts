/**
 * GET  /api/campaigns/[id]/compliance — Fair Housing scan of everything generated for this campaign + its listing description.
 * POST /api/campaigns/[id]/compliance — apply one-click rewrites ({ ruleIds?: string[] }; omit = every rewritable finding).
 * Owner only. Deterministic rules (lib/compliance/fair-housing.ts) — no AI call, so no spend and no variance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { rateLimitCompliance, rateLimitHeaders } from '@/lib/ratelimit'
import { getCampaign } from '@/lib/user-service'
import { db } from '@/lib/db'
import { campaigns, listings } from '@/lib/db/schema'
import { RULES, applyRewrites, mapStrings, scanFields } from '@/lib/compliance/fair-housing'

const Id = z.string().uuid()
const Body = z.object({ ruleIds: z.array(z.enum(RULES.map(r => r.id) as [string, ...string[]])).max(RULES.length).optional() })

type Campaign = NonNullable<Awaited<ReturnType<typeof getCampaign>>>

function textFields(c: Campaign) {
  return {
    'Listing description': c.listing?.description ?? '',
    'Facebook posts': c.facebookPosts ?? [],
    'Instagram posts': c.instagramPosts ?? [],
    'Just Listed email': c.emailJustListed ?? '',
    'Still Available email': c.emailStillAvailable ?? '',
    'Video scripts': c.videoScript ?? '',
    'Other generated content': c.analytics ?? {},
  }
}

async function load(clerkId: string, rawId: string): Promise<Campaign> {
  const id = Id.parse(rawId)
  const rl = await rateLimitCompliance(clerkId)
  if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))
  const c = await getCampaign(id, clerkId)
  if (!c) throw new ApiError(404, 'Campaign not found')
  return c
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    const c = await load(clerkId, (await params).id)
    const findings = scanFields(textFields(c)).map(f => ({
      ruleId: f.ruleId, category: f.category, severity: f.severity, match: f.match, message: f.message,
      after: f.after, section: f.section, context: f.context,
    }))
    return NextResponse.json({ findings }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleApiError(err, { route: 'campaigns/compliance.get' })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const c = await load(clerkId, (await params).id)
    const { ruleIds } = Body.parse(await readJson(request, 2 * 1024))

    let changes = 0
    const fix = (s: string) => {
      const r = applyRewrites(s, ruleIds)
      changes += r.applied.length
      return r.text
    }
    const patch = {
      facebookPosts: mapStrings(c.facebookPosts, fix),
      instagramPosts: mapStrings(c.instagramPosts, fix),
      emailJustListed: c.emailJustListed ? fix(c.emailJustListed) : c.emailJustListed,
      emailStillAvailable: c.emailStillAvailable ? fix(c.emailStillAvailable) : c.emailStillAvailable,
      videoScript: c.videoScript ? fix(c.videoScript) : c.videoScript,
      analytics: mapStrings(c.analytics, fix),
    }
    const description = c.listing?.description ? fix(c.listing.description) : null

    if (changes > 0) {
      await db.update(campaigns).set({ ...patch, updatedAt: new Date() }).where(and(eq(campaigns.id, c.id), eq(campaigns.agentId, c.agentId)))
      if (description !== null && c.listingId && description !== c.listing?.description) {
        await db.update(listings).set({ description }).where(and(eq(listings.id, c.listingId), eq(listings.agentId, c.agentId)))
      }
    }
    return NextResponse.json({ ok: true, changes })
  } catch (err) {
    return handleApiError(err, { route: 'campaigns/compliance.post' })
  }
}
