import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserWithDetails, upsertBrandKit, writeAuditLog } from '@/lib/user-service'
import { z } from 'zod'

const BrandKitSchema = z.object({
  agentName: z.string().max(100).optional(),
  agentTitle: z.string().max(100).optional(),
  agentPhone: z.string().max(30).optional(),
  agentEmail: z.string().email().optional().or(z.literal('')),
  agentWebsite: z.string().url().optional().or(z.literal('')),
  brokerageName: z.string().max(150).optional(),
  tagline: z.string().max(200).optional(),
  disclaimer: z.string().max(500).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.string().max(50).optional(),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramHandle: z.string().max(50).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
  agentPhotoUrl: z.string().optional().or(z.literal('')),
  brokerageLogo: z.string().url().optional().or(z.literal('')),
  tone: z.enum(['professional', 'friendly', 'luxury', 'energetic']).optional(),
})

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserWithDetails(userId)
  return NextResponse.json({ brandKit: user?.brandKit ?? null })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = BrandKitSchema.parse(body)

    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check plan — brand kit requires starter+
    const planTier = user.organization?.plan ?? 'free'
    if (planTier === 'free') {
      return NextResponse.json(
        { error: 'Brand Kit requires a Starter plan or above. Please upgrade.' },
        { status: 403 }
      )
    }

    // Extract tone and pass as aiPersona (full object to avoid partial JSONB issues)
    const { tone, ...rest } = data as any
    const upsertData = {
      ...rest,
      ...(tone ? {
        aiPersona: {
          tone,
          writingStyle: '',
          tagline: rest.tagline ?? '',
          specialties: [],
          marketArea: rest.brokerageName ?? '',
        }
      } : {}),
    }
    const brandKit = await upsertBrandKit(user.id, user.orgId!, upsertData)

    await writeAuditLog({
      orgId: user.orgId ?? undefined,
      userId: user.id,
      action: 'brand_kit.updated',
      resourceType: 'brand_kit',
      resourceId: brandKit?.id,
      metadata: { fields: Object.keys(data) },
    })

    return NextResponse.json({ brandKit, success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: err.errors }, { status: 400 })
    }
    console.error('Brand kit error:', err)
    return NextResponse.json({ error: 'Failed to save brand kit' }, { status: 500 })
  }
}
