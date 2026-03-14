/**
 * POST /api/campaigns/[id]/regenerate
 *
 * Regenerates a single section of an existing campaign without re-fetching
 * the MLS listing or consuming a campaign quota slot.
 *
 * Body: { section: SectionKey }
 *
 * Valid sections:
 *   listingCopy | social | email | emailDrip | print |
 *   video | microsite | photoCaptions
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserWithDetails, getCampaign } from '@/lib/user-service'
import { canAccessFeature } from '@/lib/stripe'
import type { PlanTier } from '@/lib/plans'
import { z } from 'zod'

export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const SECTION_KEYS = [
  'listingCopy',
  'social',
  'email',
  'emailDrip',
  'print',
  'video',
  'microsite',
  'photoCaptions',
] as const

type SectionKey = typeof SECTION_KEYS[number]

const RequestSchema = z.object({
  section: z.enum(SECTION_KEYS),
})

// ── Section → prompt builder ───────────────────────────────────

function buildSectionPrompt(section: SectionKey, listing: any, planTier: PlanTier, brandKit?: any): string {
  const address = [listing.address, listing.city, listing.state].filter(Boolean).join(', ')
  const price = listing.price ? `$${Number(listing.price).toLocaleString()}` : 'Price upon request'
  const beds = listing.bedrooms ?? 0
  const baths = listing.bathrooms ?? 0
  const sqft = listing.sqft ?? 0
  const description = listing.description ?? ''
  const city = listing.city ?? ''
  const state = listing.state ?? ''

  const hasBrandKit = canAccessFeature(planTier, 'brand_kit') && !!brandKit
  const agentName = hasBrandKit ? (brandKit?.agentName || 'Your Agent') : 'Your Agent'
  const agentPhone = hasBrandKit ? (brandKit?.agentPhone || '') : ''
  const agentEmail = hasBrandKit ? (brandKit?.agentEmail || '') : ''
  const agentTitle = hasBrandKit ? (brandKit?.agentTitle || 'REALTOR®') : 'REALTOR®'
  const brokerageName = hasBrandKit ? (brandKit?.brokerageName || '') : ''
  const tone = hasBrandKit ? (brandKit?.tone || 'professional') : 'professional'
  const tagline = hasBrandKit ? (brandKit?.tagline || '') : ''
  const toneGuides: Record<string, string> = {
    professional: 'authoritative, data-driven, and polished.',
    friendly: 'warm, conversational, and approachable.',
    luxury: 'elevated, aspirational, and refined.',
    energetic: 'enthusiastic, compelling, and urgent.',
  }
  const toneGuide = toneGuides[tone] ?? toneGuides['professional']
  const agentSigParts = [agentName, agentTitle, brokerageName, agentPhone, agentEmail].filter(Boolean)
  const agentSignature = agentSigParts.join(' | ')
  const listingContext = `LISTING: ${address} | ${price} | ${beds}bd ${baths}ba ${sqft.toLocaleString()}sqft\nDESCRIPTION: ${description}\nAGENT: ${agentSignature}\nTONE: ${toneGuide}`
  const weekThemes = `WEEK THEMES: 1:Just Listed 2:Property Features 3:Neighborhood 4:Open House 5:Investment Value 6:Final Call`
  const rules = `RULES: Return ONLY valid JSON — no markdown, no code fences, no commentary. Write like a trusted local expert, never a hype machine. No AI clichés ("dream home", "this won't last"). Real estate compliance: never mention race, religion, national origin, sex, disability, familial status.`

  switch (section) {
    case 'listingCopy':
      return `You are a senior real estate copywriter. Regenerate fresh listing copy for this property. ${rules}

${listingContext}

Return JSON:
{
  "listingCopy": {
    "headline": "Single strongest headline (12 words max)",
    "headlineVariations": ["variation 1","variation 2","variation 3","variation 4","variation 5","variation 6","variation 7","variation 8","variation 9","variation 10"],
    "fullDescription": "400-600 word professional MLS description. Scene-setting hook, key features, neighborhood context, CTA.",
    "bulletPoints": ["Point 1","Point 2","Point 3","Point 4","Point 5","Point 6","Point 7","Point 8"],
    "neighborhoodStory": "80-100 word neighborhood lifestyle paragraph",
    "seoMetaTitle": "SEO meta title under 60 characters",
    "seoMetaDescription": "SEO meta description 150-160 characters",
    "spanishDescription": "100-150 word Spanish translation",
    "toneVariants": {
      "luxury": "50-word luxury reframe",
      "firstTimeBuyer": "50-word first-time buyer reframe",
      "investor": "50-word investor/ROI reframe"
    }
  }
}`

    case 'social':
      return `You are a senior real estate social media strategist. Regenerate a fresh 6-week social calendar. ${rules}

${listingContext}
${weekThemes}

Return JSON:
{
  "facebook": [
    {"week": 1, "theme": "Just Listed", "copy": "150-200 word Facebook post. Storytelling opener, 3 key features, neighborhood context, CTA. End with agent signature on its own line: ${agentSignature}", "hashtags": ["justlisted","${city.toLowerCase().replace(/\s/g, '')}","realestate","realtor","homeforsale"]},
    {"week": 2, "theme": "Property Features", "copy": "...", "hashtags": ["..."]},
    {"week": 3, "theme": "Neighborhood & Lifestyle", "copy": "...", "hashtags": ["..."]},
    {"week": 4, "theme": "Open House", "copy": "...", "hashtags": ["..."]},
    {"week": 5, "theme": "Investment Value", "copy": "...", "hashtags": ["..."]},
    {"week": 6, "theme": "Final Call", "copy": "...", "hashtags": ["..."]}
  ],
  "instagram": [
    {"week": 1, "caption": "120-150 word Instagram caption. Hook line, sensory details, 3 features, CTA. Ends with ${agentSignature}", "hashtags": ["justlisted","${city.toLowerCase().replace(/\s/g, '')}realestate","realestate","homeforsale","luxuryhomes","realtorlife","newlisting","realestateagent","${state.toLowerCase()}realestate","homesweethome"]},
    {"week": 2, "caption": "...", "hashtags": ["..."]},
    {"week": 3, "caption": "...", "hashtags": ["..."]},
    {"week": 4, "caption": "...", "hashtags": ["..."]},
    {"week": 5, "caption": "...", "hashtags": ["..."]},
    {"week": 6, "caption": "...", "hashtags": ["..."]}
  ]
}`

    case 'email':
      return `You are a senior real estate email copywriter. Regenerate fresh email copy. ${rules}

${listingContext}

Return JSON:
{
  "emailJustListed": "200-300 word Just Listed email body. Subject line as first line. Warm opening, property story, 3 key features, clear CTA with showing link placeholder. Close with ${agentSignature}",
  "emailStillAvailable": "200-300 word Still Available email body. Urgency without desperation. Re-introduce the home, price/value angle, fresh CTA. Close with ${agentSignature}"
}`

    case 'emailDrip':
      return `You are a senior real estate email strategist. Regenerate a fresh 8-template drip sequence. ${rules}

${listingContext}

Return JSON:
{
  "emailDrip": {
    "sellerUpdate": "150-word seller market update email body",
    "buyerDripDay1": "200-word Day 1 buyer intro email — introduce yourself, the listing, and your value",
    "buyerDripDay7": "150-word Day 7 follow-up — new angle on the property, answer common objections",
    "buyerDripDay14": "150-word Day 14 check-in — neighborhood spotlight, lifestyle angle",
    "buyerDripDay30": "150-word Day 30 final nudge — urgency, what-if-you-wait angle, direct CTA",
    "openHouseInvite": "100-word open house invitation email — date/time placeholder, casual/exciting tone",
    "postShowingFeedback": "80-word post-showing thank-you + feedback request — warm, professional",
    "marketReport": "150-word local market report email — recent sales context, positioning this listing as the right move"
  }
}`

    case 'print':
      return `You are a senior real estate print copywriter. Regenerate fresh print and offline materials. ${rules}

${listingContext}

Return JSON:
{
  "printMaterials": {
    "yardSignRider": "6-8 word yard sign rider text (e.g. '4BD + Pool | Open Sat 1-4')",
    "postcardHeadline": "Postcard front headline — punchy, under 10 words",
    "postcardBody": "60-80 word postcard back copy — neighborhood focus, key features, CTA",
    "openHouseSignIn": "Welcome message for open house sign-in sheet — warm and professional",
    "brochureCopy": "200-250 word property brochure copy — full story, all features, lifestyle, CTA",
    "magazineAd": "80-100 word luxury magazine ad copy — aspirational, concise, brand-forward"
  }
}`

    case 'video':
      return `You are a senior real estate video strategist. Regenerate fresh video and reel scripts. ${rules}

${listingContext}
${weekThemes}

Return JSON:
{
  "reelScripts": [
    {"week": 1, "title": "Just Listed Hook", "duration": "30-45 sec", "hook": "Opening line spoken to camera", "script": "Full word-for-word script with [scene directions]", "captions": ["text 1","text 2","text 3"], "music": "Suggested music vibe"},
    {"week": 2, "title": "Feature Showcase", "duration": "30-45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 3, "title": "Neighborhood Story", "duration": "30-45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 4, "title": "Open House Invite", "duration": "30-45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 5, "title": "Investment Angle", "duration": "30-45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."},
    {"week": 6, "title": "Final Call", "duration": "30-45 sec", "hook": "...", "script": "...", "captions": ["..."], "music": "..."}
  ],
  "virtualTourScripts": [
    {"type": "Matterport Walkthrough", "duration": "90 sec", "script": "Full room-by-room narration script"},
    {"type": "30-Second Highlight Reel", "duration": "30 sec", "script": "Fast-paced highlight script"},
    {"type": "Drone Footage Voice-Over", "duration": "45 sec", "script": "Aerial footage narration"},
    {"type": "What Buyers Will Love", "duration": "60 sec", "script": "Timed walkthrough narration"}
  ]
}`

    case 'microsite':
      return `You are a senior real estate web copywriter. Regenerate fresh microsite copy. ${rules}

${listingContext}

Return JSON:
{
  "micrositeCopy": {
    "heroHeadline": "Hero section headline — maximum 10 words, aspirational",
    "heroSubheadline": "Hero subheadline — 15-20 words, key value proposition",
    "aboutHeading": "About this home section heading — 4-6 words",
    "aboutBody": "120-150 word about-this-home body copy — storytelling, sensory details",
    "neighborhoodHeading": "Neighborhood section heading",
    "neighborhoodBody": "80-100 word neighborhood lifestyle body copy",
    "ctaHeading": "Call-to-action section heading — action-oriented",
    "ctaSubtext": "30-40 word CTA subtext — urgency, reassurance",
    "photoCaptionTemplate": "Generic photo caption template with [ROOM] and [FEATURE] placeholders"
  }
}`

    case 'photoCaptions':
      return `You are a real estate photo caption specialist. Regenerate fresh photo caption templates. Since no photos are attached, generate compelling generic captions for a property like this. ${rules}

${listingContext}

Return JSON:
{
  "photoCaptions": [
    {"photoIndex": 0, "room": "Exterior/Front", "altText": "SEO alt text under 125 chars", "instagramCaption": "40-60 word Instagram caption — scene-setting, sensory. End with hook to DM for a showing.", "overlayText": "3-5 word Stories overlay text", "stagingNote": "One concrete staging or photography tip"},
    {"photoIndex": 1, "room": "Living Room", "altText": "...", "instagramCaption": "...", "overlayText": "...", "stagingNote": "..."},
    {"photoIndex": 2, "room": "Kitchen", "altText": "...", "instagramCaption": "...", "overlayText": "...", "stagingNote": "..."},
    {"photoIndex": 3, "room": "Primary Bedroom", "altText": "...", "instagramCaption": "...", "overlayText": "...", "stagingNote": "..."},
    {"photoIndex": 4, "room": "Primary Bathroom", "altText": "...", "instagramCaption": "...", "overlayText": "...", "stagingNote": "..."}
  ]
}`

    default:
      throw new Error(`Unknown section: ${section}`)
  }
}

// ── Section → DB column mapper ─────────────────────────────────

function applyContentToUpdate(section: SectionKey, content: any, existing: any) {
  // Returns { coreUpdate, analyticsUpdate } — both are partial
  const analytics = (existing.analytics ?? {}) as Record<string, any>

  switch (section) {
    case 'listingCopy':
      return {
        coreUpdate: {},
        analyticsUpdate: { ...analytics, listingCopy: content.listingCopy },
      }
    case 'social':
      return {
        coreUpdate: {
          facebookPosts: content.facebook ?? existing.facebookPosts,
          instagramPosts: content.instagram ?? existing.instagramPosts,
        },
        analyticsUpdate: analytics,
      }
    case 'email':
      return {
        coreUpdate: {
          emailJustListed: content.emailJustListed ?? existing.emailJustListed,
          emailStillAvailable: content.emailStillAvailable ?? existing.emailStillAvailable,
        },
        analyticsUpdate: analytics,
      }
    case 'emailDrip':
      return {
        coreUpdate: {},
        analyticsUpdate: { ...analytics, emailDrip: content.emailDrip },
      }
    case 'print':
      return {
        coreUpdate: {},
        analyticsUpdate: { ...analytics, printMaterials: content.printMaterials },
      }
    case 'video':
      return {
        coreUpdate: {
          videoScript: JSON.stringify({
            reelScripts: content.reelScripts ?? [],
            virtualTourScripts: content.virtualTourScripts ?? [],
          }),
        },
        analyticsUpdate: analytics,
      }
    case 'microsite':
      return {
        coreUpdate: {},
        analyticsUpdate: { ...analytics, micrositeCopy: content.micrositeCopy },
      }
    case 'photoCaptions':
      return {
        coreUpdate: {},
        analyticsUpdate: { ...analytics, photoCaptions: content.photoCaptions },
      }
    default:
      return { coreUpdate: {}, analyticsUpdate: analytics }
  }
}

// ── POST handler ───────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: campaignId } = await params

  try {
    const body = await request.json()
    const { section } = RequestSchema.parse(body)

    // Auth + plan check
    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    const planTier = (user.organization?.plan ?? 'free') as PlanTier

    // Section gating
    if (section === 'video' && !canAccessFeature(planTier, 'video_script')) {
      return NextResponse.json({ error: 'Video scripts require Pro or higher.' }, { status: 403 })
    }
    if (['emailDrip', 'microsite', 'photoCaptions'].includes(section) && !canAccessFeature(planTier, 'brand_kit')) {
      return NextResponse.json({ error: 'This section requires Starter or higher.' }, { status: 403 })
    }

    // Fetch campaign with listing join — getCampaign validates ownership via agentId
    const campaign = await getCampaign(campaignId, userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Build listing context from the joined listing row
    const listing = (campaign as any).listing
    const listingContext = {
      address: listing?.address ?? '',
      city: listing?.city ?? '',
      state: listing?.state ?? '',
      price: listing?.price ?? null,
      bedrooms: listing?.bedrooms ?? 0,
      bathrooms: listing?.bathrooms ?? 0,
      sqft: listing?.sqft ?? 0,
      description: listing?.description ?? '',
      features: listing?.features ?? [],
    }

    const brandKit = (campaign as any).brandKit ?? user.brandKit

    const prompt = buildSectionPrompt(section, listingContext, planTier, brandKit)

    // Call Claude with targeted mini-prompt
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let content: any
    try {
      content = JSON.parse(cleaned)
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) content = JSON.parse(m[0])
      else throw new Error('AI response could not be parsed. Please try again.')
    }

    // Apply changes to DB
    const { coreUpdate, analyticsUpdate } = applyContentToUpdate(section, content, campaign)

    if (Object.keys(coreUpdate).length > 0) {
      await db.update(campaigns)
        .set({ ...coreUpdate, updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId))
    }

    await db.update(campaigns)
      .set({ analytics: analyticsUpdate as any, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))

    return NextResponse.json({ success: true, section, content })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid section specified' }, { status: 400 })
    }
    console.error('Regenerate error:', err)
    const message = err instanceof Error ? err.message : 'Failed to regenerate section'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
