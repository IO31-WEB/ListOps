import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserWithDetails, upsertBrandKit, writeAuditLog, checkCampaignQuota } from '@/lib/user-service'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Normalize a URL value: prepend https:// if the user omitted the protocol,
// pass through empty/undefined as-is, reject anything that still isn't a
// recognisable URL after normalisation.
function normalizeUrl(v: string | undefined): string | undefined {
  if (!v || v.trim() === '') return ''
  const trimmed = v.trim()
  // Already has a protocol
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // Looks like a domain/path — prepend https://
  if (/^[\w-]+(\.[\w-]+)/.test(trimmed)) return `https://${trimmed}`
  return trimmed // let refine catch truly malformed values
}

// Helper: accepts a valid URL string, empty string, or undefined/null.
// Also auto-prepends https:// when the protocol is missing.
const optionalUrl = () =>
  z.string().optional()
    .transform(normalizeUrl)
    .refine(
      (v) => !v || v === '' || /^https?:\/\/.+\..+/.test(v),
      { message: 'Must be a valid URL or empty' }
    )

const optionalEmail = () =>
  z.string().optional().refine(
    (v) => !v || v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'Must be a valid email or empty' }
  )

const BrandKitSchema = z.object({
  agentName: z.string().max(100).optional(),
  agentTitle: z.string().max(100).optional(),
  agentPhone: z.string().max(30).optional(),
  agentEmail: optionalEmail(),
  agentWebsite: optionalUrl(),
  brokerageName: z.string().max(150).optional(),
  tagline: z.string().max(200).optional(),
  disclaimer: z.string().max(500).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.string().max(50).optional(),
  facebookUrl: optionalUrl(),
  instagramHandle: z.string().max(50).optional(),
  linkedinUrl: optionalUrl(),
  logoUrl: z.string().optional(),
  agentPhotoUrl: z.string().optional(),
  brokerageLogo: optionalUrl(),
  tone: z.enum(['professional', 'friendly', 'luxury', 'energetic']).optional(),
})

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserWithDetails(userId)
  // aiPersona lives on the users table, not brandKits — merge it in so the
  // frontend can read brandKit.aiPersona.tone reliably
  const brandKit = user?.brandKit
    ? { ...user.brandKit, aiPersona: (user as any).aiPersona ?? null }
    : null
  return NextResponse.json({ brandKit })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = BrandKitSchema.parse(body)

    const [user, quota] = await Promise.all([
      getUserWithDetails(userId),
      checkCampaignQuota(userId),
    ])
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check plan — brand kit requires starter+
    // Use checkCampaignQuota (same source as /api/billing/info) so Clerk metadata
    // overrides are respected and the plan check stays in sync with the UI.
    const planTier = quota.planTier
    if (planTier === 'free') {
      return NextResponse.json(
        { error: 'Brand Kit requires a Starter plan or above. Please upgrade.' },
        { status: 403 }
      )
    }

    // tone lives on users.aiPersona — strip it from brandKit upsert, save separately
    const { tone, ...rest } = data as any
    // Normalize instagramHandle — strip leading @ if present
    if (rest.instagramHandle) {
      rest.instagramHandle = rest.instagramHandle.replace(/^@+/, '')
    }
    const brandKit = await upsertBrandKit(user.id, user.orgId!, rest)

    // Save tone to users.aiPersona (the column that actually exists for this field)
    if (tone) {
      await db.update(users)
        .set({ aiPersona: { tone, writingStyle: '', tagline: rest.tagline ?? '', specialties: [], marketArea: rest.brokerageName ?? '' } })
        .where(eq(users.clerkId, userId))
    }

    await writeAuditLog({
      orgId: user.orgId ?? undefined,
      userId: user.id,
      action: 'brand_kit.updated',
      resourceType: 'brand_kit',
      resourceId: brandKit?.id,
      metadata: { fields: Object.keys(data) },
    })

    // Merge aiPersona back into response so frontend state stays in sync
    const returnedBrandKit = brandKit
      ? { ...brandKit, aiPersona: tone ? { tone, writingStyle: '', tagline: rest.tagline ?? '', specialties: [], marketArea: rest.brokerageName ?? '' } : null }
      : null
    return NextResponse.json({ brandKit: returnedBrandKit, success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: err.errors }, { status: 400 })
    }
    console.error('Brand kit error:', err)
    return NextResponse.json({ error: 'Failed to save brand kit' }, { status: 500 })
  }
}
