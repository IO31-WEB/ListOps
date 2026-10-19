/**
 * POST /api/uploads/listing-photo   (multipart/form-data, field "file")
 *
 * Auth -> rate limit -> size cap -> MAGIC-BYTE validation -> upload under the
 * caller's own key prefix. The client never chooses the storage key.
 *
 * NOTE: Vercel serverless functions reject request bodies over ~4.5 MB, so the
 * form downsizes photos in the browser first; the 4 MB cap here matches that.
 */
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { ApiError, handleApiError, requireUserId } from '@/lib/api-utils'
import { rateLimitUpload, rateLimitHeaders } from '@/lib/ratelimit'
import { sniffImage } from '@/lib/image-validate'
import { uploadToR2, getR2Url } from '@/lib/r2'
import { photoKeyPrefix } from '@/lib/listing-schemas'
import { getUserWithDetails } from '@/lib/user-service'

export const maxDuration = 30
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()

    const rl = await rateLimitUpload(userId)
    if (!rl.success) throw new ApiError(429, 'Too many uploads. Please wait a few minutes.', rateLimitHeaders(rl))

    // Must be a real, onboarded user (not just any Clerk session)
    const user = await getUserWithDetails(userId)
    if (!user) throw new ApiError(404, 'Account not found')

    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > MAX_BYTES + 64 * 1024) throw new ApiError(413, 'Photo is too large (max 4 MB).')

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      throw new ApiError(400, 'Invalid upload')
    }
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'No file provided')
    if (file.size === 0 || file.size > MAX_BYTES) throw new ApiError(413, 'Photo must be under 4 MB.')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const kind = sniffImage(bytes)
    if (!kind) throw new ApiError(415, 'Only JPG, PNG or WebP photos are supported.')

    const key = `${photoKeyPrefix(userId)}${nanoid(16)}.${kind.ext}`
    const url = await uploadToR2({ key, body: bytes, contentType: kind.mime })
    if (!url) throw new ApiError(503, 'Photo storage is unavailable right now. Please try again.')

    return NextResponse.json({ key, url: getR2Url(key) }, { status: 201 })
  } catch (err) {
    return handleApiError(err, { route: 'uploads/listing-photo' })
  }
}
