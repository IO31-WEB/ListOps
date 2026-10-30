/**
 * Listing persistence. EVERY query is scoped by agent_id so a user can only ever
 * read or write their own listings — this is the single choke point for that rule.
 */
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns, listings, listingUploads } from '@/lib/db/schema'
import { deleteFromR2 } from '@/lib/r2'
import { photoUrl } from '@/lib/photos'
import { inArray } from 'drizzle-orm'
import { assertOwnPhotoKeys, type ListingInput } from '@/lib/listing-schemas'
import { readHoa } from '@/lib/hoa'

function toRow(clerkId: string, input: ListingInput) {
  const keys = assertOwnPhotoKeys(clerkId, input.photoKeys)
  return {
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip ?? null,
    price: input.price != null ? String(input.price) : null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms != null ? String(input.bathrooms) : null,
    sqft: input.sqft ?? null,
    yearBuilt: input.yearBuilt ?? null,
    propertyType: input.propertyType ?? null,
    description: input.description ?? null,
    commercial: input.commercial ?? null,
    // No HOA fee/notes are kept when the agent answered "No"; omitted = not answered (null).
    hoa: input.hoa ? readHoa(input.hoa) : null,
    features: input.features,
    photoKeys: keys,
    photos: keys.map(photoUrl),
    source: input.source,
    enrichmentProvider: input.enrichmentProvider ?? null,
    updatedAt: new Date(),
  }
}

export async function createListing(user: { id: string; orgId: string | null }, clerkId: string, input: ListingInput) {
  const [row] = await db
    .insert(listings)
    .values({ ...toRow(clerkId, input), agentId: user.id, orgId: user.orgId ?? undefined })
    .returning()
  return row
}

/** Delete R2 objects + tracking rows (best effort; the nightly cleanup job is the safety net). */
async function purgePhotos(keys: string[]) {
  if (!keys.length) return
  const results = await Promise.all(keys.map(async k => [k, await deleteFromR2(k)] as const))
  const gone = results.filter(([, ok]) => ok).map(([k]) => k)
  if (gone.length) await db.delete(listingUploads).where(inArray(listingUploads.key, gone))
}

export async function updateListing(userDbId: string, clerkId: string, id: string, input: ListingInput) {
  const before = await getOwnListing(userDbId, id)
  if (!before) return null
  const [row] = await db
    .update(listings)
    .set(toRow(clerkId, input))
    .where(and(eq(listings.id, id), eq(listings.agentId, userDbId)))
    .returning()
  if (row) {
    const keep = new Set(row.photoKeys ?? [])
    await purgePhotos((before.photoKeys ?? []).filter(k => !keep.has(k))) // photos the agent removed
  }
  return row ?? null
}

export async function getOwnListing(userDbId: string, id: string) {
  return (
    (await db.query.listings.findFirst({
      where: and(eq(listings.id, id), eq(listings.agentId, userDbId)),
    })) ?? null
  )
}

export async function deleteOwnListing(userDbId: string, id: string) {
  // campaigns.listing_id has a FK to listings — detach campaigns (keep the generated
  // content) instead of failing the delete. Ownership is verified first.
  const owned = await getOwnListing(userDbId, id)
  if (!owned) return false
  await db.update(campaigns).set({ listingId: null }).where(eq(campaigns.listingId, id))
  const photoKeys = owned.photoKeys ?? []
  const rows = await db
    .delete(listings)
    .where(and(eq(listings.id, id), eq(listings.agentId, userDbId)))
    .returning({ id: listings.id })
  if (rows.length > 0) await purgePhotos(photoKeys)
  return rows.length > 0
}

export async function listOwnListings(userDbId: string, limit = 50) {
  return db.query.listings.findMany({
    where: eq(listings.agentId, userDbId),
    orderBy: [desc(listings.createdAt)],
    limit,
  })
}
