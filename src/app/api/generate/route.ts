/**
 * Campaign Generation API
 * Generates only the content types the user's plan includes.
 *
 * FREE:     Facebook (6) + Instagram (6) + Email (2) — no brand kit applied
 * STARTER:  FREE + brand kit applied to content
 * PRO:      STARTER + Video/Reel Scripts (6)
 * BROKERAGE/ENTERPRISE: PRO + white-label brand override
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { campaigns, listings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserWithDetails, checkCampaignQuota, incrementCampaignUsage } from '@/lib/user-service'
import { canAccessFeature } from '@/lib/stripe'
import type { PlanTier } from '@/lib/stripe'
import { z } from 'zod'
import { slugify } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const RequestSchema = z.object({
  mlsId: z.string().min(1).max(50),
})

// ── Demo listing fallback ─────────────────────────────────────
function getDemoListing(mlsId: string) {
  return {
    mlsId,
    listPrice: 649000,
    remarks: 'Stunning 4-bedroom home nestled in a quiet cul-de-sac. Featuring an open-concept kitchen with quartz countertops, hardwood floors throughout, and a spacious backyard perfect for entertaining. The primary suite includes a spa-like bathroom with dual vanities. Minutes from top-rated schools, shopping, and dining.',
    address: {
      deliveryLine: '2847 Oakwood Circle',
      line1: '2847 Oakwood Circle',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    },
    property: {
      bedrooms: 4,
      bathsFull: 3,
      area: 2850,
      yearBuilt: 2018,
      type: 'Single Family',
      features: ['Hardwood Floors', 'Quartz Countertops', 'Open Concept', 'Backyard', 'Two-Car Garage', 'Smart Home'],
    },
    agent: { firstName: 'Alex', lastName: 'Johnson', contact: { office: '512-555-0100' } },
    photos: [],
  }
}

// ── Fetch listing from SimplyRETS ─────────────────────────────
async function fetchMLSListing(mlsId: string) {
  const apiKey = process.env.SIMPLYRETS_API_KEY
  const apiSecret = process.env.SIMPLYRETS_API_SECRET

  const credentials = apiKey && apiSecret
    ? Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    : Buffer.from('simplyrets:simplyrets').toString('base64')

  try {
    const res = await fetch(`https://api.simplyrets.com/properties/${mlsId}`, {
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.log(`MLS lookup failed (${res.status}) for ${mlsId} — using demo data`)
      return { data: getDemoListing(mlsId), isDemo: true }
    }
    return { data: await res.json(), isDemo: false }
  } catch {
    console.log(`MLS connection failed for ${mlsId} — using demo data`)
    return { data: getDemoListing(mlsId), isDemo: true }
  }
}

// ── Build prompt — only requests what the plan unlocks ────────
function buildCampaignPrompt(listing: any, planTier: PlanTier, brandKit?: any) {
  const address = [
    listing.address?.deliveryLine || listing.address?.line1,
    listing.address?.city,
    listing.address?.state,
  ].filter(Boolean).join(', ')

  const price = listing.listPrice ? `$${listing.listPrice.toLocaleString()}` : 'Price upon request'
  const beds = listing.property?.bedrooms ?? 0
  const baths = listing.property?.bathsFull ?? 0
  const sqft = listing.property?.area ?? 0
  const yearBuilt = listing.property?.yearBuilt ?? ''
  const propertyType = listing.property?.type ?? 'Residential'
  const description = listing.remarks ?? ''
  const features = Array.isArray(listing.property?.features) ? listing.property.features.join(', ') : ''
  const city = listing.address?.city ?? ''

  // Brand kit only applied for starter+ plans
  const hasBrandKit = canAccessFeature(planTier, 'brand_kit') && !!brandKit
  const agentName = hasBrandKit
    ? (brandKit?.agentName || `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent')
    : `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent'
  const agentPhone = hasBrandKit ? (brandKit?.agentPhone || listing.agent?.contact?.office || '') : ''
  const tone = hasBrandKit ? (brandKit?.aiPersona?.tone || 'professional') : 'professional'
  const tagline = hasBrandKit ? (brandKit?.tagline || '') : ''

  // White-label: brokerage overrides with their brand
  const isWhiteLabel = canAccessFeature(planTier, 'white_label') && brandKit?.brokerageName
  const brandingLine = isWhiteLabel
    ? `Brokerage: ${brandKit.brokerageName} — remove all CampaignAI mentions`
    : 'Presented by CampaignAI'

  const listingUrl = `https://campaignai.io/l/listing-${listing.mlsId || listing.listingId}`

  const toneGuides: Record<string, string> = {
    professional: 'authoritative, data-driven, and polished.',
    friendly: 'warm, conversational, and approachable.',
    luxury: 'elevated, aspirational, and refined.',
    energetic: 'enthusiastic, compelling, and urgent.',
  }
  const toneGuide = toneGuides[tone] ?? toneGuides['professional']

  // Feature flags
  const includeReelScripts = canAccessFeature(planTier, 'video_script')

  // Build JSON schema based on plan
  const jsonSchema = `{
  "facebook": [
    {"week": 1, "theme": "Just Listed", "copy": "150-250 word post including ${listingUrl}", "hashtags": ["realtor","justlisted","${city.toLowerCase().replace(/\s/g, '')}realestate"]}
  ],
  "instagram": [
    {"week": 1, "caption": "100-150 word caption including ${listingUrl}", "hashtags": ["justlisted","realestate","homeforsale","${city.toLowerCase().replace(/\s/g, '')}homes"]}
  ],
  "emailJustListed": "200-300 word just listed email body with full property details and CTA",
  "emailStillAvailable": "150-200 word still available follow-up with urgency"${includeReelScripts ? `,
  "reelScripts": [
    {
      "week": 1,
      "title": "Just Listed Hook",
      "duration": "30–45 sec",
      "hook": "Opening line spoken to camera — grabs attention in 3 seconds",
      "script": "Full word-for-word spoken script with scene directions in [brackets]. Natural, energetic, conversational. Include address, price, top features. End with a clear CTA.",
      "captions": ["on-screen text line 1", "on-screen text line 2", "on-screen text line 3"],
      "music": "Suggested music vibe"
    }
  ]` : ''}
}`

  return `You are an expert real estate marketing copywriter. Generate a 6-week campaign for this listing.

LISTING:
- Address: ${address}
- Price: ${price}
- Beds: ${beds} | Baths: ${baths} | Sqft: ${sqft.toLocaleString()}
- Year Built: ${yearBuilt} | Type: ${propertyType}
- Description: ${description}
- Features: ${features}
- City: ${city}
- URL: ${listingUrl}

AGENT: ${agentName}${agentPhone ? ` | ${agentPhone}` : ''}${tagline ? ` | "${tagline}"` : ''}
TONE: ${toneGuide}
BRANDING: ${brandingLine}

WEEK THEMES:
1: Just Listed — excitement, first impressions
2: Property Features — best rooms and details
3: Neighborhood & Lifestyle — area, schools, walkability
4: Open House — invite and social proof
5: Investment Value — ROI, market position
6: Final Call — urgency, still available

Return ONLY valid JSON (no markdown, no code fences):

${jsonSchema}

Rules:
- Generate all 6 weeks for facebook and instagram
${includeReelScripts ? '- Generate all 6 weeks for reelScripts — each unique to its theme\n- Reel scripts must feel authentic, like real agent videos not ads' : ''}
- Return ONLY the JSON object`
}

// ── POST handler ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { mlsId } = RequestSchema.parse(body)

    // checkCampaignQuota syncs Clerk metadata → DB before checking
    const quota = await checkCampaignQuota(userId)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `You've used all ${quota.limit} campaigns this month. Upgrade to Pro for unlimited campaigns.`, quota },
        { status: 403 }
      )
    }

    const planTier = quota.planTier
    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Only apply brand kit for starter+ plans
    const brandKit = canAccessFeature(planTier, 'brand_kit') ? user.brandKit : null

    const startMs = Date.now()
    const { data: mlsData, isDemo } = await fetchMLSListing(mlsId)

    const address = [
      mlsData.address?.deliveryLine || mlsData.address?.line1,
      mlsData.address?.city,
      mlsData.address?.state,
    ].filter(Boolean).join(', ')

    // Cache listing in DB
    let listingRecord
    try {
      const existingListing = await db.query.listings.findFirst({
        where: and(eq(listings.mlsId, mlsId), eq(listings.agentId, user.id)),
      })
      if (existingListing) {
        listingRecord = existingListing
      } else {
        const [newListing] = await db.insert(listings).values({
          mlsId,
          agentId: user.id,
          orgId: user.orgId ?? undefined,
          address: mlsData.address?.deliveryLine || mlsData.address?.line1,
          city: mlsData.address?.city,
          state: mlsData.address?.state,
          zip: mlsData.address?.postalCode,
          price: mlsData.listPrice?.toString(),
          bedrooms: mlsData.property?.bedrooms,
          bathrooms: mlsData.property?.bathsFull?.toString(),
          sqft: mlsData.property?.area,
          yearBuilt: mlsData.property?.yearBuilt,
          propertyType: mlsData.property?.type,
          description: mlsData.remarks,
          features: mlsData.property?.features ?? [],
          photos: mlsData.photos ?? [],
          rawData: mlsData,
          listingAgentName: `${mlsData.agent?.firstName ?? ''} ${mlsData.agent?.lastName ?? ''}`.trim(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }).returning()
        listingRecord = newListing
      }
    } catch (dbErr) {
      console.error('DB listing error (non-fatal):', dbErr)
    }

    // Create campaign record
    const micrositeSlug = `${slugify(address)}-${Date.now()}`
    let campaignRecord: any
    try {
      const [rec] = await db.insert(campaigns).values({
        listingId: listingRecord?.id ?? undefined,
        agentId: user.id,
        orgId: user.orgId ?? undefined,
        brandKitId: brandKit?.id ?? undefined,
        status: 'generating',
        micrositeSlug,
      }).returning()
      campaignRecord = rec
    } catch (dbErr) {
      console.error('DB campaign error (non-fatal):', dbErr)
    }

    // Generate — prompt scoped to plan
    const prompt = buildCampaignPrompt(mlsData, planTier, brandKit)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let campaignContent: any
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      campaignContent = JSON.parse(cleaned)
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try { campaignContent = JSON.parse(jsonMatch[0]) }
        catch { throw new Error('AI response could not be parsed. Please try again.') }
      } else {
        throw new Error('AI response could not be parsed. Please try again.')
      }
    }

    const generationMs = Date.now() - startMs

    // Save only what the plan includes
    if (campaignRecord) {
      try {
        await db.update(campaigns)
          .set({
            status: 'complete',
            generationMs,
            facebookPosts: campaignContent.facebook,
            instagramPosts: campaignContent.instagram,
            emailJustListed: campaignContent.emailJustListed,
            emailStillAvailable: campaignContent.emailStillAvailable,
            // Only save video scripts for pro+
            videoScript: canAccessFeature(planTier, 'video_script') && campaignContent.reelScripts
              ? JSON.stringify(campaignContent.reelScripts)
              : null,
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, campaignRecord.id))
      } catch (dbErr) {
        console.error('DB update error (non-fatal):', dbErr)
      }
    }

    await incrementCampaignUsage(userId)

    return NextResponse.json({
      campaignId: campaignRecord?.id,
      isDemo,
      planTier,
      listing: {
        address,
        price: mlsData.listPrice ? `$${mlsData.listPrice.toLocaleString()}` : 'Price on request',
        beds: mlsData.property?.bedrooms ?? 0,
        baths: mlsData.property?.bathsFull ?? 0,
        sqft: mlsData.property?.area ?? 0,
        photos: mlsData.photos ?? [],
        description: mlsData.remarks ?? '',
      },
      facebook: campaignContent.facebook,
      instagram: campaignContent.instagram,
      emailJustListed: campaignContent.emailJustListed,
      emailStillAvailable: campaignContent.emailStillAvailable,
      // Only returned for pro+
      reelScripts: canAccessFeature(planTier, 'video_script')
        ? (campaignContent.reelScripts ?? [])
        : null,
      generationMs,
    })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid MLS ID format' }, { status: 400 })
    }
    console.error('Generation error:', err)
    return NextResponse.json(
      { error: err.message || 'Campaign generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
