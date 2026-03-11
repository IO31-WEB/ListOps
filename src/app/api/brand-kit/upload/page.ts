/**
 * Brand Kit Image Upload
 *
 * Accepts a multipart/form-data POST with a single `file` field.
 * Uploads to Cloudflare R2 and returns the public URL.
 * Falls back gracefully (400) when R2 is not configured so the client
 * can fall back to a base64 data URL in development.
 *
 * Constraints enforced here (not just on the client):
 *   - Auth required
 *   - Starter+ plan required
 *   - Image MIME types only
 *   - 5 MB max
 *   - field name must be one of the three allowed slots
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getUserWithDetails } from '@/lib/user-service'
import { uploadToR2 } from '@/lib/r2'
import { canAccess } from '@/lib/plans'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
])

const ALLOWED_SLOTS = new Set(['logo', 'agentPhoto', 'brokerageLogo'])

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

const QuerySchema = z.object({
  slot: z.enum(['logo', 'agentPhoto', 'brokerageLogo']),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse ?slot= query param
  const query = QuerySchema.safeParse({
    slot: request.nextUrl.searchParams.get('slot'),
  })
  if (!query.success) {
    return NextResponse.json(
      { error: `slot must be one of: ${[...ALLOWED_SLOTS].join(', ')}` },
      { status: 400 }
    )
  }
  const { slot } = query.data

  const user = await getUserWithDetails(userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const planTier = user.organization?.plan ?? 'free'
  if (!canAccess(planTier, 'brand_kit')) {
    return NextResponse.json(
      { error: 'Brand Kit requires a Starter plan or above.' },
      { status: 403 }
    )
  }

  // R2 must be configured — tell the client to fall back to base64 if not
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return NextResponse.json(
      { error: 'R2_NOT_CONFIGURED', fallback: true },
      { status: 400 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, SVG, or GIF.` },
      { status: 415 }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.` },
      { status: 413 }
    )
  }

  const ext = file.type === 'image/svg+xml' ? 'svg'
    : file.type === 'image/png'  ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif'  ? 'gif'
    : 'jpg'

  // Scoped to user so different users can't overwrite each other's assets
  const key = `brand-kits/${user.id}/${slot}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadToR2({ key, body: buffer, contentType: file.type })

  if (!url) {
    return NextResponse.json(
      { error: 'Upload to storage failed. Please try again.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ url, slot })
}
