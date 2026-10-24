/** GET / PUT / DELETE /api/listings/:id — always scoped to the signed-in agent. */
import { normalizeListing } from '@/lib/address'
import { resolveListingPhotos } from '@/lib/photos'
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { rateLimitListingWrite, rateLimitHeaders } from '@/lib/ratelimit'
import { ListingInputSchema, UuidSchema } from '@/lib/listing-schemas'
import { getUserWithDetails } from '@/lib/user-service'
import { deleteOwnListing, getOwnListing, updateListing } from '@/lib/listing-service'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

async function resolve(ctx: Ctx) {
  const userId = await requireUserId()
  const { id: rawId } = await ctx.params
  const id = UuidSchema.safeParse(rawId)
  if (!id.success) throw new ApiError(404, 'Not found') // 404, not 400: don't reveal id format rules
  const user = await getUserWithDetails(userId)
  if (!user) throw new ApiError(404, 'Account not found')
  return { userId, user, id: id.data }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { user, id } = await resolve(ctx)
    const row = await getOwnListing(user.id, id)
    if (!row) throw new ApiError(404, 'Not found')
    // Whitelist the response — never return rawData / enrichmentData wholesale
    return NextResponse.json({
      listing: {
        id: row.id, ...normalizeListing({ address: row.address, city: row.city, state: row.state }), zip: row.zip,
        price: row.price ? Number(row.price) : null, bedrooms: row.bedrooms,
        bathrooms: row.bathrooms ? Number(row.bathrooms) : null, sqft: row.sqft, yearBuilt: row.yearBuilt,
        propertyType: row.propertyType, description: row.description, features: row.features ?? [],
        photos: resolveListingPhotos(row), photoKeys: row.photoKeys ?? [], source: row.source,
      },
    })
  } catch (err) {
    return handleApiError(err, { route: 'listings/[id] GET' })
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const { userId, user, id } = await resolve(ctx)
    const rl = await rateLimitListingWrite(userId)
    if (!rl.success) throw new ApiError(429, 'Too many requests. Please slow down.', rateLimitHeaders(rl))
    const input = ListingInputSchema.parse(await readJson(request))
    const row = await updateListing(user.id, userId, id, input)
    if (!row) throw new ApiError(404, 'Not found')
    return NextResponse.json({ id: row.id })
  } catch (err) {
    return handleApiError(err, { route: 'listings/[id] PUT' })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { userId, user, id } = await resolve(ctx)
    const ok = await deleteOwnListing(user.id, id)
    if (!ok) throw new ApiError(404, 'Not found')
    await logAudit({ action: 'listing.deleted', actorClerkId: userId, targetUserId: user.id, resourceType: 'listing', resourceId: id, request: req })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'listings/[id] DELETE' })
  }
}
