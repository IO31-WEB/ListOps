import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCampaign, getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { resolvePlan } from '@/lib/plan-resolve'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const campaign = await getCampaign(id, userId)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Server-side plan gate on READ as well as generate: what comes back is what the CURRENT plan owns.
  const viewer = await getUserWithDetails(userId)
  const plan = resolvePlan(viewer)
  if ((campaign as any).campaignType === 'commercial' && !canAccess(plan, 'commercial_campaigns')) {
    return NextResponse.json({ error: 'Commercial campaigns are part of the Commercial plan.', upgrade: true, locked: 'commercial' }, { status: 403 })
  }
  const can = (f: Parameters<typeof canAccess>[1]) => canAccess(plan, f)

  // Auto-expire campaigns stuck in 'generating' for more than 10 minutes.
  // This happens when the Vercel function times out before the AI finishes.
  if (campaign.status === 'generating') {
    const ageMs = Date.now() - new Date(campaign.createdAt).getTime()
    if (ageMs > 10 * 60 * 1000) {
      try {
        await db.update(campaigns)
          .set({ status: 'failed', failureReason: 'Timed out', updatedAt: new Date() })
          .where(eq(campaigns.id, campaign.id))
        campaign.status = 'failed'
      } catch { /* non-fatal */ }
    }
  }

  // Unpack content modules stored in the analytics JSONB column onto the top-level
  // campaign object so the frontend can read them directly (e.g. campaign.tiktok,
  // campaign.listingCopy) rather than campaign.analytics.tiktok.
  const analytics = (campaign.analytics ?? {}) as Record<string, any>

  // Parse videoScript — stored as a JSON string '{"reelScripts":[...], "virtualTourScripts":[...]}'
  let reelScripts: any[] | null = null
  let virtualTourScripts: any[] | null = null
  if (campaign.videoScript) {
    try {
      const parsed = JSON.parse(campaign.videoScript)
      reelScripts = parsed.reelScripts ?? null
      virtualTourScripts = parsed.virtualTourScripts ?? null
    } catch { /* ignore parse errors */ }
  }

  const enriched = {
    ...campaign,
    // Content modules from analytics column
    listingCopy:    analytics.listingCopy    ?? null,
    emailDrip:      can('email_drip') ? (analytics.emailDrip ?? null) : null,
    printMaterials: analytics.printMaterials ?? null,
    photoCaptions:  can('photo_captions') ? (analytics.photoCaptions ?? null) : null,
    micrositeCopy:  can('microsite_copy') ? (analytics.micrositeCopy ?? null) : null,
    tiktok:         can('expanded_social') ? (analytics.tiktok ?? null) : null,
    linkedin:       can('expanded_social') ? (analytics.linkedin ?? null) : null,
    xThreads:       can('expanded_social') ? (analytics.xThreads ?? null) : null,
    stories:        can('expanded_social') ? (analytics.stories ?? null) : null,
    hashtagPacks:   can('expanded_social') ? (analytics.hashtagPacks ?? null) : null,
    campaignType:   (campaign as any).campaignType ?? 'residential',
    commercial:     can('commercial_campaigns') ? (analytics.commercial ?? null) : null,
    // Parsed video scripts
    reelScripts: can('video_script') ? reelScripts : null,
    virtualTourScripts: can('virtual_tour_scripts') ? virtualTourScripts : null,
  }

  return NextResponse.json({ campaign: enriched })
}
