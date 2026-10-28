/**
 * GET /api/brand-assets/<brand-kits/userId/slot-version.ext>
 *
 * Public by design (logos and headshots appear on public microsites and flyers). Safe because only keys with
 * the exact shape our brand-kit upload generates are served (no traversal, no other prefixes), the content type
 * comes from the key's extension (never from storage metadata), and nosniff is set. Versioned keys never change
 * content, so they are cached for a year; older unversioned keys are cached briefly because a re-upload replaced them.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getFromR2 } from '@/lib/r2'
import { isBrandAssetKey, isVersionedBrandKey } from '@/lib/brand-assets'

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params
  const key = (parts ?? []).join('/')
  if (!isBrandAssetKey(key)) return new NextResponse('Not found', { status: 404 })

  const obj = await getFromR2(key)
  if (!obj) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=30' } })

  return new NextResponse(obj.body, {
    status: 200,
    headers: {
      'Content-Type': TYPES[key.split('.').pop() as string] ?? 'application/octet-stream',
      'Cache-Control': isVersionedBrandKey(key)
        ? 'public, max-age=31536000, s-maxage=31536000, immutable'
        : 'public, max-age=300, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  })
}
