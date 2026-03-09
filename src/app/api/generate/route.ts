/**
 * Campaign Generation API
 *
 * FIXES APPLIED:
 * 1. consumeCampaignQuota() replaces checkCampaignQuota + incrementCampaignUsage
 *    — eliminates TOCTOU race that allowed free users to bypass limits
 * 2. Quota is consumed BEFORE calling Claude — no free generations on DB failure
 * 3. Slow generation alert (>30s) sent to Sentry
 * 4. Explicit ANTHROPIC_API_KEY check at startup
 *
 * FREE:     Facebook (6) + Instagram (6) + Email (2) — no brand kit
 * STARTER:  FREE + brand kit applied + microsite
 * PRO:      STARTER + Video/Reel Scripts (6)
 * BROKERAGE/ENTERPRISE: PRO + white-label brand override
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { campaigns, listings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserWithDetails, consumeCampaignQuota } from '@/lib/user-service'
import { canAccessFeature } from '@/lib/stripe'
import type { PlanTier } from '@/lib/plans'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import { rateLimitGenerate } from '@/lib/ratelimit'
import { captureError, trackGenerationCost } from '@/lib/monitoring'
import { trackCampaignGenerated } from '@/lib/posthog'

// FIX: Explicit startup check — prevents opaque cold-start crash if key is missing
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('[generate] ANTHROPIC_API_KEY is not set. Check your environment variables.')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const RequestSchema = z.object({
  mlsId: z.string().min(1).max(50),
})

// ── Demo listing fallback ──────────────────────────────────────
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

// ── Fetch listing from SimplyRETS ──────────────────────────────
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

// ── Build prompt — scoped to what the plan unlocks ─────────────
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

  const hasBrandKit = canAccessFeature(planTier, 'brand_kit') && !!brandKit
  const agentName = hasBrandKit
    ? (brandKit?.agentName || `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent')
    : `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent'
  const agentPhone = hasBrandKit ? (brandKit?.agentPhone || listing.agent?.contact?.office || '') : ''
  const agentEmail = hasBrandKit ? (brandKit?.agentEmail || '') : ''
  const agentTitle = hasBrandKit ? (brandKit?.agentTitle || 'REALTOR®') : 'REALTOR®'
  const brokerageName = hasBrandKit ? (brandKit?.brokerageName || '') : ''
  const tone = hasBrandKit ? (brandKit?.aiPersona?.tone || 'professional') : 'professional'
  const tagline = hasBrandKit ? (brandKit?.tagline || '') : ''

  const isWhiteLabel = canAccessFeature(planTier, 'white_label') && brandKit?.brokerageName
  const isPaidPlan = planTier !== 'free'
  const brandingLine = isWhiteLabel
    ? `Brokerage: ${brandKit.brokerageName} — remove all CampaignAI mentions`
    : isPaidPlan
    ? `Agent: ${agentName} — do not mention CampaignAI in any outputs`
    : 'Presented by CampaignAI'

  const listingUrl = `https://campaignai.io/l/listing-${listing.mlsId || listing.listingId}`

  const toneGuides: Record<string, string> = {
    professional: 'authoritative, data-driven, and polished.',
    friendly: 'warm, conversational, and approachable.',
    luxury: 'elevated, aspirational, and refined.',
    energetic: 'enthusiastic, compelling, and urgent.',
  }
  const toneGuide = toneGuides[tone] ?? toneGuides['professional']

  const includeReelScripts = canAccessFeature(planTier, 'video_script')

  // Agent signature block required at the bottom of every Facebook/Instagram post
  const agentSignatureParts = [agentName, agentTitle, brokerageName, agentPhone, agentEmail].filter(Boolean)
  const agentSignature = agentSignatureParts.join(' | ')

  const jsonSchema = `{
  "facebook": [
    {"week": 1, "theme": "Just Listed", "copy": "2-3 focused paragraphs (130-180 words). Open with a vivid scene-setting hook — make the reader feel the home. Naturally weave in 2-3 standout features. Close with a direct CTA and ${listingUrl}. Final line break then agent signature exactly: ${agentSignature}", "hashtags": ["realtor","justlisted","${city.toLowerCase().replace(/\s/g, '')}realestate","${city.toLowerCase().replace(/\s/g, '')}homes","newhome"]}
  ],
  "instagram": [
    {"week": 1, "caption": "80-120 words. Bold 1-line hook (no emoji opener). 2-3 sentences on the lifestyle. CTA + ${listingUrl}. Final line then agent signature: ${agentSignature}", "hashtags": ["justlisted","realestate","homeforsale","${city.toLowerCase().replace(/\s/g, '')}homes","realtor","listingagent"]}
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

  return `You are a senior real estate marketing strategist and copywriter. Your copy is published directly to MLS clients — it must be polished, persuasive, legally compliant, and indistinguishable from expert human writing.

LISTING:
- Address: ${address}
- Price: ${price}
- Beds: ${beds} | Baths: ${baths} | Sqft: ${sqft.toLocaleString()}
- Year Built: ${yearBuilt} | Type: ${propertyType}
- Description: ${description}
- Features: ${features}
- City: ${city}
- URL: ${listingUrl}

AGENT: ${agentName}${agentPhone ? ` | ${agentPhone}` : ''}${agentEmail ? ` | ${agentEmail}` : ''}${brokerageName ? ` | ${brokerageName}` : ''}${tagline ? ` | "${tagline}"` : ''}
TONE: ${toneGuide}
BRANDING: ${brandingLine}

WEEK THEMES:
1: Just Listed — excitement, first impressions
2: Property Features — showcase the best rooms and details
3: Neighborhood & Lifestyle — area, schools, walkability, community
4: Open House — invitation, social proof, FOMO
5: Investment Value — ROI, market position, appreciation potential
6: Final Call — urgency, last chance, still available

WRITING STANDARDS — follow these exactly:
- Write like a trusted local expert, not a hype machine. No exclamation points unless truly warranted.
- Vary sentence length. Mix short punchy sentences with longer, flowing ones.
- Use specific sensory details (gleaming, sun-drenched, airy) — never vague adjectives (nice, great, amazing).
- Every post must end with the agent signature on its own line: ${agentSignature}
- No ALL CAPS except the agent signature block. No overuse of emojis.
- Facebook posts: conversational, story-first, 130-180 words of body copy + agent signature
- Instagram captions: tighter, lifestyle-led, 80-120 words of body copy + agent signature
- Each week's post must feel genuinely different — different angle, different reader, different emotional hook
- Real estate advertising compliance: no mention of race, religion, national origin, sex, disability, or familial status
- Never use the phrase "This won't last" or "Dream home" — they're clichéd and signal AI

Return ONLY valid JSON (no markdown, no code fences):

${jsonSchema}

Rules:
- Generate all 6 weeks for facebook and instagram — each week must be distinct in angle and tone
${includeReelScripts ? '- Generate all 6 weeks for reelScripts — each unique to its weekly theme\n- Reel scripts must sound like the agent speaking naturally to camera, not an ad voiceover' : ''}
- Agent signature must appear at the bottom of every facebook and instagram post
- Return ONLY the JSON object`
}

// ── POST handler ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { mlsId } = RequestSchema.parse(body)

    // Rate limit: 5 generations per 10 min per user
    const rl = await rateLimitGenerate(userId)
    if (!rl.success) {
      const resetIn = Math.ceil((rl.reset - Date.now()) / 1000 / 60)
      return NextResponse.json(
        { error: `Too many requests. You can generate again in ${resetIn} minute${resetIn === 1 ? '' : 's'}.` },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rl.reset),
            'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)),
          },
        }
      )
    }

    // FIX: consumeCampaignQuota atomically checks AND increments in one DB operation.
    // This replaces the old checkCampaignQuota + incrementCampaignUsage pattern
    // which had a TOCTOU race allowing concurrent requests to bypass the limit.
    // Quota is consumed BEFORE calling Claude so a DB failure can't yield a free generation.
    const quota = await consumeCampaignQuota(userId)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `You've used all ${quota.limit} campaigns this month. Upgrade to Pro for unlimited campaigns.`, quota },
        { status: 403 }
      )
    }

    const planTier = quota.planTier
    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

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

    // Generate with Claude
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

    // FIX: Alert on slow generations (>30s indicates a cost/performance problem)
    if (generationMs > 30_000) {
      captureError(new Error(`Slow generation: ${generationMs}ms`), { generationMs, userId, planTier, mlsId })
    }

    // Save campaign content
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

    // Track cost + performance
    trackGenerationCost({
      userId,
      planTier,
      mlsId,
      durationMs: generationMs,
      estimatedInputTokens: message.usage.input_tokens,
      estimatedOutputTokens: message.usage.output_tokens,
    })

    const contentTypes = ['facebook', 'instagram', 'email_just_listed', 'email_still_available', 'flyer']
    if (campaignContent.reelScripts) contentTypes.push('video_script')
    trackCampaignGenerated({
      userId,
      planTier,
      mlsId,
      durationMs: generationMs,
      isDemo: !!isDemo,
      contentTypes,
    })

    return NextResponse.json({
      campaignId: campaignRecord?.id,
      isDemo,
      planTier,
      brandKit: brandKit ? {
        logoUrl: brandKit.logoUrl ?? '',
        brokerageLogo: (brandKit as any).brokerageLogo ?? '',
        agentPhotoUrl: brandKit.agentPhotoUrl ?? '',
      } : null,
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
    captureError(err, { userId, context: 'campaign_generation' })
    return NextResponse.json(
      { error: err.message || 'Campaign generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
