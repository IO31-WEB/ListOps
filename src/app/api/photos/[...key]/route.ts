/**
 * GET /api/photos/<listings/userId/file.ext>
 *
 * Public by design (listing photos appear on public microsites and are shared in marketing). Safe because:
 *  - only keys matching the exact shape our upload route generates are served (no traversal, no other prefixes)
 *  - the key contains a 16-char random nanoid, so objects can't be enumerated
 *  - the content type comes from the key's extension, never from storage metadata; nosniff is set
 * Responses are immutable (keys never change content), so Vercel's CDN / browsers serve repeats without hitting R2.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getFromR2 } from '@/lib/r2'
import { isListingPhotoKey } from '@/lib/listing-schemas'

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params
  const key = (parts ?? []).join('/')
  if (!isListingPhotoKey(key)) return new NextResponse('Not found', { status: 404 })

  const obj = await getFromR2(key)
  if (!obj) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=30' } })

  return new NextResponse(obj.body, {
    status: 200,
    headers: {
      'Content-Type': TYPES[key.split('.').pop() as string] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  })
}
