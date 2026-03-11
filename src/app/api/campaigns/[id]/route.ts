import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCampaign } from '@/lib/user-service'
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

  // Auto-expire campaigns stuck in 'generating' for more than 10 minutes.
  // This happens when the Vercel function times out before the AI finishes.
  if (campaign.status === 'generating') {
    const ageMs = Date.now() - new Date(campaign.createdAt).getTime()
    if (ageMs > 10 * 60 * 1000) {
      try {
        await db.update(campaigns)
          .set({ status: 'failed', updatedAt: new Date() })
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
    emailDrip:      analytics.emailDrip      ?? null,
    printMaterials: analytics.printMaterials ?? null,
    photoCaptions:  analytics.photoCaptions  ?? null,
    micrositeCopy:  analytics.micrositeCopy  ?? null,
    tiktok:         analytics.tiktok         ?? null,
    linkedin:       analytics.linkedin       ?? null,
    xThreads:       analytics.xThreads       ?? null,
    stories:        analytics.stories        ?? null,
    hashtagPacks:   analytics.hashtagPacks   ?? null,
    // Parsed video scripts
    reelScripts,
    virtualTourScripts,
  }

  return NextResponse.json({ campaign: enriched })
}
