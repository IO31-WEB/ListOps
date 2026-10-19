/**
 * GET  /api/listings/enrich  -> { enabled }          (lets the UI hide the button)
 * POST /api/listings/enrich  -> { found, data? }     (public-records lookup, rate limited)
 *
 * The provider API keys live only in server env vars. The browser never sees them and
 * never talks to the provider directly.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { rateLimitEnrich, rateLimitHeaders } from '@/lib/ratelimit'
import { EnrichRequestSchema } from '@/lib/listing-schemas'
import { enrichAddress, enrichmentEnabled } from '@/lib/enrichment'

export async function GET() {
  try {
    await requireUserId()
    return NextResponse.json({ enabled: enrichmentEnabled() })
  } catch (err) {
    return handleApiError(err, { route: 'listings/enrich GET' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()

    const rl = await rateLimitEnrich(userId)
    if (!rl.success) throw new ApiError(429, 'Too many lookups. Please try again later.', rateLimitHeaders(rl))

    const input = EnrichRequestSchema.parse(await readJson(request, 4 * 1024))

    if (!enrichmentEnabled()) return NextResponse.json({ found: false, reason: 'disabled' })

    const data = await enrichAddress({
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
    })
    if (!data) return NextResponse.json({ found: false, reason: 'not_found' })

    return NextResponse.json({ found: true, data })
  } catch (err) {
    return handleApiError(err, { route: 'listings/enrich POST' })
  }
}
