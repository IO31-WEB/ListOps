/**
 * Microsite Publish API
 *
 * FIX: Previously blocked Starter users from publishing microsites.
 * The pricing page promises microsites to Starter+, but this route checked
 * for ['pro', 'brokerage', 'enterprise'] only — an active contract violation.
 *
 * Fix: Use canAccessFeature('listing_microsite') from the single source of truth
 * in lib/plans.ts, which correctly includes Starter.
 *
 * Also fixed: campaign ownership check was missing — any authenticated user
 * could publish/unpublish any campaign by ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkCampaignQuota, getCampaign } from '@/lib/user-service'
import { canAccessFeature } from '@/lib/stripe'
import { z } from 'zod'

const Schema = z.object({ publish: z.boolean() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quota = await checkCampaignQuota(userId)

  // FIX: canAccessFeature reads from the unified FEATURE_GATES in plans.ts
  // Starter is now correctly included (matches pricing page)
  if (!canAccessFeature(quota.planTier, 'listing_microsite')) {
    return NextResponse.json(
      { error: `Listing microsites require a Starter plan or higher. You are on ${quota.planTier}. Please upgrade.` },
      { status: 403 }
    )
  }

  const { id } = await params

  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // FIX: Verify campaign belongs to the requesting user before mutating
  // Previous version fetched the campaign without checking agentId
  const dbUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.clerkId, userId),
  })

  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.agentId, dbUser.id)),
  })

  if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const [updated] = await db.update(campaigns)
    .set({ micrositePublished: body.publish, updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.agentId, dbUser.id)))
    .returning()

  return NextResponse.json({ published: updated.micrositePublished })
}

// ── PATCH — push micrositeCopy to live microsite ──────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { micrositeCopy } = await request.json()

  const campaign = await getCampaign(id, userId)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const existing = campaign.analytics as any ?? {}
    await db.update(campaigns)
      .set({ analytics: { ...existing, micrositeCopy } as any, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Microsite copy push error:', err)
    return NextResponse.json({ error: 'Failed to update microsite copy' }, { status: 500 })
  }
}
