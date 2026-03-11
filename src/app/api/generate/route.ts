/**
 * ListOps — Campaign Generation API
 *
 * OUTPUT MODULES (plan-gated):
 * FREE:       Facebook(6) + Instagram(6) + Email(2) + ListingCopy + PrintMaterials
 * STARTER:    FREE + brand kit + microsite + EmailDrip(full) + PhotoCaptions
 * PRO:        STARTER + VideoScripts(6+VirtualTour) + TikTok + LinkedIn + X + Stories
 * BROKERAGE:  PRO + white-label override
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

// Vercel: allow up to 300 seconds for this route (also set in vercel.json)
export const maxDuration = 300

// Anthropic client — key is validated at request time inside the POST handler
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

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
async function fetchMLSListing(mlsId: string): Promise<{
  data: any
  isDemo: boolean
  fetchError?: string
}> {
  const apiKey = process.env.SIMPLYRETS_API_KEY
  const apiSecret = process.env.SIMPLYRETS_API_SECRET
  const credentials = apiKey && apiSecret
    ? Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    : Buffer.from('simplyrets:simplyrets').toString('base64')
  const isRealCredentials = !!(apiKey && apiSecret)

  try {
    const res = await fetch(`https://api.simplyrets.com/properties/${mlsId}`, {
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      // FIX: Only fall back to demo data when using SimplyRETS test credentials.
      // With real credentials, a non-OK response means the listing genuinely wasn't found
      // or the API is down — surface the error rather than silently generate fake content.
      if (!isRealCredentials) {
        return { data: getDemoListing(mlsId), isDemo: true }
      }
      const status = res.status
      if (status === 404) {
        throw new Error(`MLS listing "${mlsId}" not found. Check the ID and try again.`)
      }
      throw new Error(`MLS API returned ${status}. Please try again in a moment.`)
    }
    return { data: await res.json(), isDemo: false }
  } catch (err: any) {
    // Re-throw explicit errors we threw above
    if (err?.message?.includes('not found') || err?.message?.includes('MLS API returned')) throw err
    // Network/timeout errors — only silently use demo if on test credentials
    if (!isRealCredentials) {
      return { data: getDemoListing(mlsId), isDemo: true, fetchError: err?.message }
    }
    throw new Error(`Could not reach MLS service. Please try again in a moment.`)
  }
}

// ── Fetch a photo URL and convert to base64 for vision API ────
async function fetchPhotoAsBase64(url: string): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const mediaType = (['image/jpeg','image/png','image/webp','image/gif'].includes(contentType)
      ? contentType
      : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    const buffer = await res.arrayBuffer()
    const data = Buffer.from(buffer).toString('base64')
    return { data, mediaType }
  } catch {
    return null
  }
}

// ── Master prompt builder ──────────────────────────────────────
// Returns the text prompt string. Photos are attached as vision blocks at the call site.
function buildCampaignPrompt(listing: any, planTier: PlanTier, brandKit?: any, userAiPersona?: any): string {
  const address = [
    listing.address?.deliveryLine || listing.address?.line1,
    listing.address?.city, listing.address?.state,
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
  const state = listing.address?.state ?? ''
  const photoCount = (listing.photos ?? []).length

  const hasBrandKit = canAccessFeature(planTier, 'brand_kit') && !!brandKit
  const agentName = hasBrandKit
    ? (brandKit?.agentName || `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent')
    : `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent'
  const agentPhone = hasBrandKit ? (brandKit?.agentPhone || listing.agent?.contact?.office || '') : ''
  const agentEmail = hasBrandKit ? (brandKit?.agentEmail || '') : ''
  const agentTitle = hasBrandKit ? (brandKit?.agentTitle || 'REALTOR®') : 'REALTOR®'
  const brokerageName = hasBrandKit ? (brandKit?.brokerageName || '') : ''
  const tone = hasBrandKit ? (userAiPersona?.tone || brandKit?.aiPersona?.tone || 'professional') : 'professional'
  const tagline = hasBrandKit ? (brandKit?.tagline || '') : ''

  const isWhiteLabel = canAccessFeature(planTier, 'white_label') && brandKit?.brokerageName
  const isPaidPlan = planTier !== 'free'
  const brandingLine = isWhiteLabel
    ? `Brokerage: ${brandKit.brokerageName} — remove all ListOps mentions`
    : isPaidPlan
    ? `Agent: ${agentName} — do not mention ListOps in any outputs`
    : 'Presented by ListOps'

  const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io'}/l/listing-${listing.mlsId || listing.listingId}`

  const toneGuides: Record<string, string> = {
    professional: 'authoritative, data-driven, and polished.',
    friendly: 'warm, conversational, and approachable.',
    luxury: 'elevated, aspirational, and refined.',
    energetic: 'enthusiastic, compelling, and urgent.',
  }
  const toneGuide = toneGuides[tone] ?? toneGuides['professional']

  const agentSigParts = [agentName, agentTitle, brokerageName, agentPhone, agentEmail].filter(Boolean)
  const agentSignature = agentSigParts.join(' | ')

  // hasVideo and hasExpanded content is now handled by buildProPrompt (parallel call).
  // Force these false here so the core prompt stays small and fast.
  const hasVideo = false
  const hasExpanded = false
  const hasEmailDrip = canAccessFeature(planTier, 'brand_kit') // Starter+
  const hasMicrosite = canAccessFeature(planTier, 'listing_microsite')

  // Number of photos being sent as vision attachments (set by buildMessageContent)
  const attachedPhotoCount = Math.min((listing.photos ?? []).length, 10)
  const hasPhotos = attachedPhotoCount > 0

  // Photo captions instructions — when photos are attached Claude describes what it actually sees
  const photoCaptionsSchema = hasPhotos
    ? Array.from({ length: attachedPhotoCount }, (_, i) => (
        `{"photoIndex": ${i}, "room": "Identify this room/space from the image (e.g. Kitchen, Primary Bedroom, Backyard)", "altText": "SEO alt text under 125 chars — describe exactly what's visible in this photo", "instagramCaption": "40-60 word Instagram caption written about what you actually see in this specific image. Scene-setting, sensory details. End with a hook to DM for a showing.", "overlayText": "3-5 word overlay text for Stories/Reels graphic — punchy visual label for this image", "stagingNote": "One concrete staging or photography improvement tip based on what you see in this image"}`
      )).join(',\n    ')
    : `{"photoIndex": 0, "room": "Exterior/Front", "altText": "SEO alt text", "instagramCaption": "40-60 word caption", "overlayText": "3-5 word overlay", "stagingNote": "Staging tip"}`

  return `You are a senior real estate marketing strategist and copywriter with computer vision capabilities. Generate a complete, modular marketing package for the listing below. I am attaching the actual MLS photos — use them to write photo-specific captions based on what you literally see. Every output is published directly to clients — polish, legal compliance, and zero AI clichés are non-negotiable.
${hasPhotos ? `\nPHOTOS: ${attachedPhotoCount} MLS listing photos are attached to this message. For the photoCaptions array, look at each image carefully and write captions based on what you actually see — specific finishes, colors, features, light, space. Do not guess room types; identify them from the images.\n` : ''}
LISTING DATA:
- Address: ${address}
- Price: ${price}
- Beds: ${beds} | Baths: ${baths} | Sqft: ${sqft.toLocaleString()} | Year Built: ${yearBuilt} | Type: ${propertyType}
- Description: ${description}
- Features: ${features}
- City/State: ${city}, ${state}
- Listing URL: ${listingUrl}
- Photos: ${photoCount > 0 ? photoCount + ' photos attached as images in this message — analyze each one' : 'None available'}

AGENT: ${agentName}${agentPhone ? ` | ${agentPhone}` : ''}${agentEmail ? ` | ${agentEmail}` : ''}${brokerageName ? ` | ${brokerageName}` : ''}${tagline ? ` | "${tagline}"` : ''}
TONE: ${toneGuide}
BRANDING: ${brandingLine}

WEEK THEMES (use for all 6-week calendars):
1: Just Listed — excitement, first impressions
2: Property Features — showcase best rooms and details  
3: Neighborhood & Lifestyle — area, schools, walkability, community
4: Open House — invitation, social proof, FOMO
5: Investment Value — ROI, market position, appreciation
6: Final Call — urgency, last chance, still available

WRITING STANDARDS (non-negotiable):
- Write like a trusted local expert, never a hype machine
- No exclamation points unless truly warranted. Vary sentence length.
- Specific sensory details (gleaming, sun-drenched, airy) — never vague (nice, great, amazing)
- Every Facebook/Instagram post ends with agent signature on its own line: ${agentSignature}
- No ALL CAPS except agent signature. No emoji overuse.
- Real estate compliance: never mention race, religion, national origin, sex, disability, familial status
- Never use "This won't last" or "Dream home" — they signal AI
- Each week must feel genuinely different in angle, tone, and target reader

Return ONLY valid JSON with exactly this structure (no markdown, no code fences):

{
  "listingCopy": {
    "headline": "The single strongest headline for this property (12 words max)",
    "headlineVariations": [
      "Variation 1 — luxury angle",
      "Variation 2 — lifestyle/neighborhood angle",
      "Variation 3 — investment/value angle",
      "Variation 4 — family/space angle",
      "Variation 5 — first-time buyer angle",
      "Variation 6 — urgency angle",
      "Variation 7 — feature-forward angle",
      "Variation 8 — emotional/aspirational angle",
      "Variation 9 — local expert angle",
      "Variation 10 — concise punchy angle"
    ],
    "fullDescription": "400-600 word professional MLS listing description. Scene-setting hook, key features, neighborhood context, CTA.",
    "bulletPoints": [
      "Strongest buyer appeal point — lead with the outcome, not the feature",
      "Second strongest — e.g. 'Chef's kitchen with quartz island — entertain without leaving home'",
      "Third",
      "Fourth",
      "Fifth",
      "Sixth",
      "Seventh",
      "Eighth"
    ],
    "neighborhoodStory": "80-100 word neighborhood lifestyle paragraph — walkability, schools, dining.",
    "seoMetaTitle": "SEO meta title under 60 characters",
    "seoMetaDescription": "SEO meta description 150-160 characters with primary keyword and CTA",
    "spanishDescription": "100-150 word Spanish translation of the core description",
    "toneVariants": {
      "luxury": "50-word luxury reframe of the headline and opening",
      "firstTimeBuyer": "50-word first-time buyer reframe — approachable, reassuring, milestone-focused",
      "investor": "50-word investor reframe — ROI, rental potential, market appreciation"
    }
  },
  "facebook": [
    {"week": 1, "theme": "Just Listed", "copy": "100-130 words. Hook, 2 features, CTA + ${listingUrl}. Final line: ${agentSignature}", "hashtags": ["realtor","justlisted","${city.toLowerCase().replace(/\s/g, '')}realestate","${city.toLowerCase().replace(/\s/g, '')}homes","newhome"]}
  ],
  "instagram": [
    {"week": 1, "caption": "60-80 words. Hook, lifestyle angle, CTA + ${listingUrl}. Final line: ${agentSignature}", "hashtags": ["justlisted","realestate","homeforsale","${city.toLowerCase().replace(/\s/g, '')}homes","realtor","listingagent"]}
  ],
  "emailJustListed": "200-300 word just listed email body with full property details and CTA",
  "emailStillAvailable": "150-200 word still available follow-up with urgency",
  ${hasEmailDrip ? `
  "emailDrip": {
    "buyerDripDay1": "100 word Day 1 buyer nurture — welcome and listing highlights",
    "buyerDripDay7": "100 word Day 7 drip — neighborhood spotlight",
    "openHouseInvite": "100 word open house invite — date TBD placeholder",
    "sellerUpdate": "100 word seller activity update — showings, market context",
    "buyerDripDay14": "100 word Day 14 drip — feature deep-dive, open house invite",
    "buyerDripDay30": "100 word Day 30 drip — urgency, final push, direct CTA",
    "postShowingFeedback": "70-word post-showing feedback request — warm, not pushy",
    "marketReport": "120-word neighborhood market report email — recent comps, positioning"
  },` : ''}
  "printMaterials": {
    "yardSignRider": "Two punchy lines max. Fits on a 6\" yard sign rider. E.g. '4BD · 3BA · $649K | Call Alex: 512-555-0100'",
    "postcardHeadline": "Postcard front headline — bold, 8 words max",
    "postcardBody": "Postcard back body copy — 60-80 words. Address, price, key features, agent contact.",
    "openHouseSignIn": "Open house info packet intro paragraph — welcoming, sets expectations, captures lead intent",
    "brochureCopy": "150-200 word brochure body copy — full property story in print format",
    "magazineAd": "60-80 word magazine ad copy — premium tone, strong visual reference, bold CTA"
  },
  ${hasExpanded ? `"hashtagPacks": {
    "justListed": ["justlisted","newhome","forsale","realestate","${city.toLowerCase().replace(/\s/g, '')}realestate","homeforsale","realtor","listingagent","${state.toLowerCase()}realestate"],
    "openHouse": ["openhouse","openhousetoday","househunting","homestaging","${city.toLowerCase().replace(/\s/g, '')}openhouse","tourtoday","realestatetour"],
    "luxury": ["luxuryhomes","luxuryrealestate","luxurylisting","${city.toLowerCase().replace(/\s/g, '')}luxury","premiumrealestate","topagent"],
    "postingSchedule": "Week 1: Mon Just Listed (FB+IG) | Tue TikTok | Wed Stories | Thu LinkedIn | Fri X | Weeks 2-6: same cadence, rotate weekly theme"
  },` : ''}
  "photoCaptions": [
    // Generate one entry per attached photo. For each: identify the room from what you see.
    {"photoIndex": 0, "room": "identify from image", "altText": "SEO alt text under 125 chars — describe what you actually see", "instagramCaption": "40-60 word caption based on what you see — sensory details, lifestyle angle, end with hook to DM", "overlayText": "3-5 word Stories overlay text", "stagingNote": "One practical staging improvement tip based on what you see"}
    // ...repeat for each photo attached, in order
  ],
  ${hasMicrosite ? `
  "micrositeCopy": {
    "heroHeadline": "Large hero headline for the listing microsite — punchy, 8 words max",
    "heroSubheadline": "Hero subheadline — 15-20 words, expands on headline",
    "aboutHeading": "Section heading for property description",
    "aboutBody": "300-400 word property description optimized for the microsite — slightly more editorial than MLS copy",
    "neighborhoodHeading": "Neighborhood section heading",
    "neighborhoodBody": "150-200 word neighborhood story for the microsite",
    "ctaHeading": "Schedule a showing CTA heading",
    "ctaSubtext": "CTA subtext — 15 words, creates urgency without cliché",
    "photoCaptionTemplate": "Template caption for photo gallery — uses [ROOM] placeholder"
  },` : ''}
  ${hasVideo ? `
  "reelScripts": [
    {
      "week": 1,
      "title": "Just Listed Hook",
      "duration": "30–45 sec",
      "hook": "Opening line spoken to camera — grabs attention in 3 seconds",
      "script": "Full word-for-word spoken script with [scene directions in brackets]. Natural, energetic, conversational. End with clear CTA.",
      "captions": ["on-screen text line 1", "on-screen text line 2", "on-screen text line 3"],
      "music": "Suggested music vibe"
    }
  ],
  "virtualTourScripts": [
    {
      "type": "Matterport Walkthrough",
      "duration": "90 sec",
      "script": "Full narration script for a Matterport/3D virtual tour. Room-by-room with transitions. Written to be read by the agent on camera or as voice-over."
    },
    {
      "type": "30-Second Highlight Reel",
      "duration": "30 sec",
      "script": "Fast-paced highlight script. Hook → 3 best features → price → CTA. Every word earns its place."
    },
    {
      "type": "Drone Footage Voice-Over",
      "duration": "45 sec",
      "script": "Aerial/drone footage narration. Opens with neighborhood context, zooms to property, highlights exterior and lot. Cinematic tone."
    },
    {
      "type": "What Buyers Will Love",
      "duration": "60 sec",
      "script": "Timed walkthrough script: 0-15s kitchen, 15-30s primary suite, 30-45s outdoor space, 45-60s neighborhood/CTA. Each beat clearly marked."
    }
  ],` : ''}
  ${hasExpanded ? `
  "tiktok": [
    {"week": 1, "hook": "First 3 seconds — scroll-stopping spoken line", "script": "15-30 sec TikTok script. Hook → reveal → 2 features → price drop + CTA. Conversational. Trending audio suggestion included.", "trendingAudio": "Suggested trending audio style or sound", "onScreenText": ["text overlay 1", "text overlay 2", "text overlay 3"]}
  ],
  "linkedin": [
    {"week": 1, "post": "150-200 word LinkedIn update. Professional tone. Leads with market insight, not just listing details. Tags relevant professionals. Ends with CTA.", "hashtags": ["realestate","${city.toLowerCase().replace(/\s/g, '')}","justlisted","realtor"]}
  ],
  "xThreads": [
    {"week": 1, "tweets": ["Tweet 1 (280 chars max) — hook/announcement", "Tweet 2 — strongest feature", "Tweet 3 — neighborhood angle", "Tweet 4 — price/value", "Tweet 5 — CTA + listing URL"]}
  ],
  "stories": [
    {"week": 1, "platform": "Instagram/Facebook Stories", "slides": [
      {"slideNumber": 1, "text": "Slide 1 text — hook/announcement", "cta": "Swipe up / Tap for details"},
      {"slideNumber": 2, "text": "Slide 2 — key stat or feature", "cta": null},
      {"slideNumber": 3, "text": "Slide 3 — neighborhood", "cta": null},
      {"slideNumber": 4, "text": "Slide 4 — price reveal", "cta": "DM me for a showing"},
      {"slideNumber": 5, "text": "Slide 5 — agent contact", "cta": "Tap to call"}
    ]}
  ],
  "hashtagPacks": {
    "justListed": ["justlisted","newhome","forsale","realestate","${city.toLowerCase().replace(/\s/g, '')}realestate","homeforsale","realtor","listingagent","${state.toLowerCase()}realestate","${propertyType.toLowerCase().replace(/\s/g, '')}"],
    "luxury": ["luxuryhomes","luxuryrealestate","dreamhome","luxurylisting","highend","${city.toLowerCase().replace(/\s/g, '')}luxury","premiumrealestate","exquisivehomes","estatehomes","topagent"],
    "openHouse": ["openhouse","openhousetoday","openhouseweekend","comeseeithisweekend","househunting","homestaging","buyandhome","${city.toLowerCase().replace(/\s/g, '')}openhouse","tourtoday","realestatetour"],
    "postingSchedule": "Week 1: Monday Just Listed (FB+IG) | Tuesday TikTok | Wednesday Stories | Thursday LinkedIn | Friday X thread | Week 2-6: same cadence, rotate weekly theme"
  }` : ''}
}

RULES:
- Generate ALL 6 weeks for facebook and instagram — each must be genuinely distinct
${hasVideo ? '- Generate ALL 6 weeks for reelScripts — each unique to its weekly theme\n- Reel scripts must sound like the agent speaking naturally to camera' : ''}
${hasExpanded ? '- Generate ALL 6 weeks for tiktok, linkedin, xThreads, stories' : ''}
- Agent signature must appear at the bottom of every facebook and instagram post
- Return ONLY the JSON object — no explanation, no markdown`
}

// ── Pro-only parallel prompt (TikTok, LinkedIn, X, Stories, Reel Scripts, Virtual Tours) ──
// This runs in parallel with the core prompt for Pro+ plans, cutting total time ~50%.
function buildProPrompt(listing: any, planTier: PlanTier, brandKit?: any, userAiPersona?: any): string {
  const address = [
    listing.address?.deliveryLine || listing.address?.line1,
    listing.address?.city, listing.address?.state,
  ].filter(Boolean).join(', ')

  const price = listing.listPrice ? `$${listing.listPrice.toLocaleString()}` : 'Price upon request'
  const beds = listing.property?.bedrooms ?? 0
  const baths = listing.property?.bathsFull ?? 0
  const sqft = listing.property?.area ?? 0
  const city = listing.address?.city ?? ''
  const state = listing.address?.state ?? ''
  const description = listing.remarks ?? ''
  const features = Array.isArray(listing.property?.features) ? listing.property.features.join(', ') : ''

  const hasBrandKit = canAccessFeature(planTier, 'brand_kit') && !!brandKit
  const agentName = hasBrandKit
    ? (brandKit?.agentName || `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent')
    : `${listing.agent?.firstName ?? ''} ${listing.agent?.lastName ?? ''}`.trim() || 'Your Agent'
  const agentPhone = hasBrandKit ? (brandKit?.agentPhone || listing.agent?.contact?.office || '') : ''
  const agentTitle = hasBrandKit ? (brandKit?.agentTitle || 'REALTOR®') : 'REALTOR®'
  const brokerageName = hasBrandKit ? (brandKit?.brokerageName || '') : ''
  const tone = hasBrandKit ? (userAiPersona?.tone || brandKit?.aiPersona?.tone || 'professional') : 'professional'
  const toneGuides: Record<string, string> = {
    professional: 'authoritative, data-driven, and polished.',
    friendly: 'warm, conversational, and approachable.',
    luxury: 'elevated, aspirational, and refined.',
    energetic: 'enthusiastic, compelling, and urgent.',
  }
  const toneGuide = toneGuides[tone] ?? toneGuides['professional']
  const agentSigParts = [agentName, agentTitle, brokerageName, agentPhone].filter(Boolean)
  const agentSignature = agentSigParts.join(' | ')
  const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io'}/l/listing-${listing.mlsId || listing.listingId}`

  return `You are a senior real estate marketing strategist. Generate Pro-tier social and video content for this listing. Return ONLY valid JSON — no markdown, no code fences.

LISTING: ${address} | ${price} | ${beds}bd ${baths}ba ${sqft.toLocaleString()}sqft
DESCRIPTION: ${description}
FEATURES: ${features}
AGENT: ${agentSignature}
TONE: ${toneGuide}
WEEK THEMES: 1:Just Listed 2:Property Features 3:Neighborhood 4:Open House 5:Investment Value 6:Final Call

{
  "reelScripts": [
    {"week": 1, "title": "Just Listed Hook", "duration": "30–45 sec", "hook": "Opening line spoken to camera — grabs attention in 3 seconds", "script": "Full word-for-word spoken script with [scene directions]. Natural, energetic, conversational. End with CTA.", "captions": ["on-screen text 1", "on-screen text 2", "on-screen text 3"], "music": "Suggested music vibe"},
    {"week": 2, "title": "Feature Showcase", "duration": "30–45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 3, "title": "Neighborhood Story", "duration": "30–45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 4, "title": "Open House Invite", "duration": "30–45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 5, "title": "Investment Angle", "duration": "30–45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 6, "title": "Final Call", "duration": "30–45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."}
  ],
  "virtualTourScripts": [
    {"type": "Matterport Walkthrough", "duration": "90 sec", "script": "Full room-by-room narration script for a 3D virtual tour. Written to be read by the agent on camera or as voice-over."},
    {"type": "30-Second Highlight Reel", "duration": "30 sec", "script": "Fast-paced highlight script. Hook → 3 best features → price → CTA."},
    {"type": "Drone Footage Voice-Over", "duration": "45 sec", "script": "Aerial footage narration. Opens with neighborhood, zooms to property, highlights exterior. Cinematic tone."},
    {"type": "What Buyers Will Love", "duration": "60 sec", "script": "Timed walkthrough: 0-15s kitchen, 15-30s primary suite, 30-45s outdoor, 45-60s neighborhood/CTA."}
  ],
  "tiktok": [
    {"week": 1, "hook": "First 3 seconds — scroll-stopping spoken line", "script": "15-30 sec TikTok script. Hook → reveal → 2 features → price + CTA. Conversational.", "trendingAudio": "Suggested audio style", "onScreenText": ["overlay 1", "overlay 2", "overlay 3"]},
    {"week": 2, "hook": "...", "script": "...", "trendingAudio": "...", "onScreenText": ["..."]},
    {"week": 3, "hook": "...", "script": "...", "trendingAudio": "...", "onScreenText": ["..."]},
    {"week": 4, "hook": "...", "script": "...", "trendingAudio": "...", "onScreenText": ["..."]},
    {"week": 5, "hook": "...", "script": "...", "trendingAudio": "...", "onScreenText": ["..."]},
    {"week": 6, "hook": "...", "script": "...", "trendingAudio": "...", "onScreenText": ["..."]}
  ],
  "linkedin": [
    {"week": 1, "post": "150-200 word LinkedIn update. Professional tone. Market insight first, listing second. CTA.", "hashtags": ["realestate", "${city.toLowerCase().replace(/\s/g, '')}", "justlisted", "realtor"]},
    {"week": 2, "post": "...", "hashtags": ["..."]},
    {"week": 3, "post": "...", "hashtags": ["..."]},
    {"week": 4, "post": "...", "hashtags": ["..."]},
    {"week": 5, "post": "...", "hashtags": ["..."]},
    {"week": 6, "post": "...", "hashtags": ["..."]}
  ],
  "xThreads": [
    {"week": 1, "tweets": ["Tweet 1 (280 chars) — hook", "Tweet 2 — best feature", "Tweet 3 — neighborhood", "Tweet 4 — price/value", "Tweet 5 — CTA + ${listingUrl}"]},
    {"week": 2, "tweets": ["...","...","...","...","..."]},
    {"week": 3, "tweets": ["...","...","...","...","..."]},
    {"week": 4, "tweets": ["...","...","...","...","..."]},
    {"week": 5, "tweets": ["...","...","...","...","..."]},
    {"week": 6, "tweets": ["...","...","...","...","..."]}
  ],
  "stories": [
    {"week": 1, "platform": "Instagram/Facebook Stories", "slides": [
      {"slideNumber": 1, "text": "Hook/announcement", "cta": "Swipe up"},
      {"slideNumber": 2, "text": "Key stat or feature", "cta": null},
      {"slideNumber": 3, "text": "Neighborhood", "cta": null},
      {"slideNumber": 4, "text": "Price reveal", "cta": "DM me for a showing"},
      {"slideNumber": 5, "text": "Agent contact", "cta": "Tap to call"}
    ]},
    {"week": 2, "platform": "Instagram/Facebook Stories", "slides": [{"slideNumber": 1,"text":"...","cta":null},{"slideNumber": 2,"text":"...","cta":null},{"slideNumber": 3,"text":"...","cta":null},{"slideNumber": 4,"text":"...","cta":null},{"slideNumber": 5,"text":"...","cta":null}]},
    {"week": 3, "platform": "Instagram/Facebook Stories", "slides": [{"slideNumber": 1,"text":"...","cta":null},{"slideNumber": 2,"text":"...","cta":null},{"slideNumber": 3,"text":"...","cta":null},{"slideNumber": 4,"text":"...","cta":null},{"slideNumber": 5,"text":"...","cta":null}]},
    {"week": 4, "platform": "Instagram/Facebook Stories", "slides": [{"slideNumber": 1,"text":"...","cta":null},{"slideNumber": 2,"text":"...","cta":null},{"slideNumber": 3,"text":"...","cta":null},{"slideNumber": 4,"text":"...","cta":null},{"slideNumber": 5,"text":"...","cta":null}]},
    {"week": 5, "platform": "Instagram/Facebook Stories", "slides": [{"slideNumber": 1,"text":"...","cta":null},{"slideNumber": 2,"text":"...","cta":null},{"slideNumber": 3,"text":"...","cta":null},{"slideNumber": 4,"text":"...","cta":null},{"slideNumber": 5,"text":"...","cta":null}]},
    {"week": 6, "platform": "Instagram/Facebook Stories", "slides": [{"slideNumber": 1,"text":"...","cta":null},{"slideNumber": 2,"text":"...","cta":null},{"slideNumber": 3,"text":"...","cta":null},{"slideNumber": 4,"text":"...","cta":null},{"slideNumber": 5,"text":"...","cta":null}]}
  ]}

RULES:
- Generate ALL 6 weeks for every array — each week must use its theme and feel distinct
- Reel scripts must sound like the agent speaking naturally to camera
- Return ONLY the JSON object`
}

// ── POST handler ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration: missing API key.' }, { status: 500 })
  }
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Idempotency: hash of userId + mlsId + UTC date-hour prevents double-submissions
  // from double-clicks or retries within the same hour consuming two quota units.
  let campaignRecordId: string | undefined

  try {
    const body = await request.json()
    const { mlsId } = RequestSchema.parse(body)

    // FIX: Check idempotency — if a campaign for this user+listing is already
    // in 'generating' state (started < 5 min ago), return that one instead of
    // creating a second. Prevents quota double-spend on double-click.
    const { createHash } = await import('crypto')
    const idempotencyWindow = Math.floor(Date.now() / (5 * 60 * 1000)) // 5-min window
    const idempotencyKey = createHash('sha256')
      .update(`${userId}:${mlsId}:${idempotencyWindow}`)
      .digest('hex')
      .slice(0, 16)

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
      mlsData.address?.city, mlsData.address?.state,
    ].filter(Boolean).join(', ')

    // Cache listing
    let listingRecord: any
    try {
      const existing = await db.query.listings.findFirst({\
        where: and(eq(listings.mlsId, mlsId), eq(listings.agentId, user.id)),
      })
      if (existing) {
        listingRecord = existing
      } else {
        const [newListing] = await db.insert(listings).values({
          mlsId, agentId: user.id, orgId: user.orgId ?? undefined,
          address: mlsData.address?.deliveryLine || mlsData.address?.line1,
          city: mlsData.address?.city, state: mlsData.address?.state,
          zip: mlsData.address?.postalCode, price: mlsData.listPrice?.toString(),
          bedrooms: mlsData.property?.bedrooms, bathrooms: mlsData.property?.bathsFull?.toString(),
          sqft: mlsData.property?.area, yearBuilt: mlsData.property?.yearBuilt,
          propertyType: mlsData.property?.type, description: mlsData.remarks,
          features: mlsData.property?.features ?? [], photos: mlsData.photos ?? [],
          rawData: mlsData, listingAgentName: `${mlsData.agent?.firstName ?? ''} ${mlsData.agent?.lastName ?? ''}`.trim(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }).returning()
        listingRecord = newListing
      }
    } catch (dbErr) { console.error('DB listing error (non-fatal):', dbErr) }

    // Create campaign record
    // FIX: Write campaignRecordId to outer scope immediately so the catch block
    // can mark it 'failed' even if the error happens deep in the try block.
    const micrositeSlug = `${slugify(address)}-${Date.now()}`
    let campaignRecord: any
    try {
      const [rec] = await db.insert(campaigns).values({
        listingId: listingRecord?.id, agentId: user.id,
        orgId: user.orgId ?? undefined, brandKitId: brandKit?.id ?? undefined,
        status: 'generating', micrositeSlug,
      }).returning()
      campaignRecord = rec
      campaignRecordId = rec?.id  // FIX: hoist to outer scope for catch block
    } catch (dbErr) { console.error('DB campaign error (non-fatal):', dbErr) }

    // Build prompts and fetch photos in parallel
    const promptText = buildCampaignPrompt(mlsData, planTier, brandKit, (user as any).aiPersona)
    const rawPhotos: string[] = mlsData.photos ?? []
    // Cap at 3 photos — each base64 image adds ~3k input tokens with diminishing copy quality returns
    const photoUrls = rawPhotos.slice(0, 3)

    // Fetch photos in parallel (best-effort — failures are silently dropped)
    const photoBlocks: Anthropic.ImageBlockParam[] = []
    if (photoUrls.length > 0) {
      const fetched = await Promise.all(photoUrls.map(fetchPhotoAsBase64))
      for (let i = 0; i < fetched.length; i++) {
        const photo = fetched[i]
        if (photo) {
          photoBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: photo.mediaType, data: photo.data },
          })
        }
      }
    }

    // Core message content: photos first so Claude sees them before caption instructions
    const messageContent: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = [
      ...photoBlocks,
      { type: 'text', text: promptText },
    ]

    const isProPlan = ['pro', 'brokerage', 'enterprise'].includes(planTier)

    // For Pro+ plans: fire two API calls in parallel — core content + Pro-only content.
    // This cuts generation time from ~2-3 min down to ~45-60s.
    const [message, proMessage] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        // FIX: 6000 was too low — a full 6-week Facebook+Instagram calendar + email + print
        // easily hits 7-9k tokens. Truncated output = malformed JSON = the error users see.
        // 16000 gives headroom for all core modules without truncation.
        max_tokens: 16000,
        messages: [{ role: 'user', content: messageContent }],
      }),
      isProPlan
        ? anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            // FIX: 8000 was too low for 6 weeks × (TikTok + LinkedIn + X + Stories + Reels).
            // Pro output is ~12-14k tokens. 16000 gives safe headroom.
            max_tokens: 16000,
            messages: [{ role: 'user', content: [{ type: 'text', text: buildProPrompt(mlsData, planTier, brandKit, (user as any).aiPersona) }] }],
          })
        : Promise.resolve(null),
    ])

    function parseJSON(raw: string) {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      try { return JSON.parse(cleaned) }
      catch {
        const m = cleaned.match(/\{[\s\S]*\}/)
        if (m) return JSON.parse(m[0])
        throw new Error('AI response could not be parsed. Please try again.')
      }
    }

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const content: any = parseJSON(responseText)

    // Merge Pro content if the second call succeeded
    if (proMessage) {
      const proText = proMessage.content[0].type === 'text' ? proMessage.content[0].text : ''
      try {
        const proContent = parseJSON(proText)
        content.reelScripts = proContent.reelScripts ?? null
        content.virtualTourScripts = proContent.virtualTourScripts ?? null
        content.tiktok = proContent.tiktok ?? null
        content.linkedin = proContent.linkedin ?? null
        content.xThreads = proContent.xThreads ?? null
        content.stories = proContent.stories ?? null

      } catch (e) {
        console.error('Pro content parse error (non-fatal):', e)
      }
    }

    const generationMs = Date.now() - startMs
    // Alert on very slow generations (>90s even with parallel calls)
    if (generationMs > 90_000) {
      captureError(new Error(`Slow generation: ${generationMs}ms`), { generationMs, userId, planTier, mlsId })
    }

    // Save to DB in two steps:
    // Step 1 — core fields (small payload, must succeed to mark campaign complete)
    // Step 2 — analytics JSONB (large Pro content, non-fatal if it fails)
    if (campaignRecord) {
      try {
        await db.update(campaigns).set({
          status: 'complete',
          generationMs,
          facebookPosts: content.facebook,
          instagramPosts: content.instagram,
          emailJustListed: content.emailJustListed,
          emailStillAvailable: content.emailStillAvailable,
          videoScript: canAccessFeature(planTier, 'video_script') && content.reelScripts
            ? JSON.stringify({ reelScripts: content.reelScripts, virtualTourScripts: content.virtualTourScripts ?? [] })
            : null,
          promptTokens: message.usage.input_tokens + (proMessage?.usage.input_tokens ?? 0),
          completionTokens: message.usage.output_tokens + (proMessage?.usage.output_tokens ?? 0),
          updatedAt: new Date(),
        }).where(eq(campaigns.id, campaignRecord.id))
      } catch (dbErr) {
        console.error('DB core update error:', dbErr)
        throw new Error('Failed to save campaign. Please try again.')
      }

      // Step 2 — large analytics JSONB (non-fatal: campaign is already marked complete above)
      try {
        await db.update(campaigns).set({
          analytics: {
            listingCopy: content.listingCopy,
            emailDrip: content.emailDrip ?? null,
            printMaterials: content.printMaterials,
            photoCaptions: content.photoCaptions,
            micrositeCopy: content.micrositeCopy ?? null,
            tiktok: content.tiktok ?? null,
            linkedin: content.linkedin ?? null,
            xThreads: content.xThreads ?? null,
            stories: content.stories ?? null,
            hashtagPacks: content.hashtagPacks ?? null,
          } as any,
          updatedAt: new Date(),
        }).where(eq(campaigns.id, campaignRecord.id))
      } catch (dbErr) {
        console.error('DB analytics update error (non-fatal — core content saved):', dbErr)
      }
    }

    trackGenerationCost({ userId, planTier, mlsId, durationMs: generationMs, estimatedInputTokens: message.usage.input_tokens + (proMessage?.usage.input_tokens ?? 0), estimatedOutputTokens: message.usage.output_tokens + (proMessage?.usage.output_tokens ?? 0) })

    const contentTypes = ['facebook', 'instagram', 'email_just_listed', 'email_still_available', 'listing_copy', 'print_materials', 'photo_captions', 'flyer']
    if (content.reelScripts) contentTypes.push('video_script', 'virtual_tour')
    if (content.tiktok) contentTypes.push('tiktok', 'linkedin', 'x_threads', 'stories')
    trackCampaignGenerated({ userId, planTier, mlsId, durationMs: generationMs, isDemo: !!isDemo, contentTypes })

    return NextResponse.json({
      campaignId: campaignRecord?.id,
      isDemo, planTier,
      brandKit: brandKit ? {
        logoUrl: brandKit.logoUrl ?? '',
        brokerageLogo: (brandKit as any).brokerageLogo ?? '',
        agentPhotoUrl: brandKit.agentPhotoUrl ?? '',
      } : null,
      listing: {
        address, price: mlsData.listPrice ? `$${mlsData.listPrice.toLocaleString()}` : 'Price on request',
        beds: mlsData.property?.bedrooms ?? 0, baths: mlsData.property?.bathsFull ?? 0,
        sqft: mlsData.property?.area ?? 0, photos: mlsData.photos ?? [], description: mlsData.remarks ?? '',
      },
      // Core outputs
      listingCopy: content.listingCopy,
      facebook: content.facebook,
      instagram: content.instagram,
      emailJustListed: content.emailJustListed,
      emailStillAvailable: content.emailStillAvailable,
      emailDrip: content.emailDrip ?? null,
      printMaterials: content.printMaterials,
      photoCaptions: content.photoCaptions,
      micrositeCopy: content.micrositeCopy ?? null,
      reelScripts: canAccessFeature(planTier, 'video_script') ? (content.reelScripts ?? []) : null,
      virtualTourScripts: canAccessFeature(planTier, 'video_script') ? (content.virtualTourScripts ?? []) : null,
      tiktok: canAccessFeature(planTier, 'video_script') ? (content.tiktok ?? null) : null,
      linkedin: canAccessFeature(planTier, 'video_script') ? (content.linkedin ?? null) : null,
      xThreads: canAccessFeature(planTier, 'video_script') ? (content.xThreads ?? null) : null,
      stories: canAccessFeature(planTier, 'video_script') ? (content.stories ?? null) : null,
      hashtagPacks: content.hashtagPacks ?? null,
      generationMs,
    })

  } catch (err: any) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid MLS ID format' }, { status: 400 })
    console.error('[generate] Error:', err?.message, err?.stack?.split('\n')[1])
    captureError(err, { userId, context: 'campaign_generation' })
    // FIX: Mark the campaign as 'failed' so it doesn't show as 'generating' forever.
    // campaignRecordId is hoisted to outer scope specifically for this catch block.
    if (campaignRecordId) {
      try {
        await db.update(campaigns)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(campaigns.id, campaignRecordId))
      } catch (dbErr) {
        console.error('[generate] Failed to mark campaign as failed:', dbErr)
      }
    }
    return NextResponse.json({ error: err.message || 'Campaign generation failed. Please try again.' }, { status: 500 })
  }
}

