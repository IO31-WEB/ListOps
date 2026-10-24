/** POST /api/listings -> create a listing (agent-entered, optionally pre-filled by enrichment). */
import { normalizeListing } from '@/lib/address'
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { rateLimitListingWrite, rateLimitHeaders } from '@/lib/ratelimit'
import { ListingInputSchema } from '@/lib/listing-schemas'
import { getUserWithDetails } from '@/lib/user-service'
import { createListing, listOwnListings } from '@/lib/listing-service'
import { assertAdult } from '@/lib/age'

export async function GET() {
  try {
    const userId = await requireUserId()
    const user = await getUserWithDetails(userId)
    if (!user) throw new ApiError(404, 'Account not found')
    const rows = await listOwnListings(user.id)
    return NextResponse.json({
      listings: rows.map(r => ({ id: r.id, ...normalizeListing({ address: r.address, city: r.city, state: r.state }), createdAt: r.createdAt })),
    })
  } catch (err) {
    return handleApiError(err, { route: 'listings GET' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const rl = await rateLimitListingWrite(userId)
    if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))

    const input = ListingInputSchema.parse(await readJson(request))
    const user = await getUserWithDetails(userId)
    if (!user) throw new ApiError(404, 'Account not found')
    assertAdult(user)

    const row = await createListing(user, userId, input)
    return NextResponse.json({ id: row.id }, { status: 201 })
  } catch (err) {
    return handleApiError(err, { route: 'listings POST' })
  }
}
