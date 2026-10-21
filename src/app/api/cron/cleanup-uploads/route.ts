/**
 * GET /api/cron/cleanup-uploads — daily Vercel Cron (see vercel.json).
 *
 * Deletes listing photos that were uploaded but never attached to a listing (abandoned forms,
 * removed photos whose inline delete failed) once they are older than 24 hours. Photos referenced by ANY
 * listing are never touched.
 *
 * Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Set CRON_SECRET in Vercel env vars.
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, inArray, lt, notExists, sql } from 'drizzle-orm'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { listings, listingUploads } from '@/lib/db/schema'
import { deleteFromR2 } from '@/lib/r2'
import { handleApiError } from '@/lib/api-utils'

export const maxDuration = 60
const MIN_AGE_MS = 24 * 60 * 60 * 1000
const BATCH = 300

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false // refuse to run unauthenticated
  const given = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const cutoff = new Date(Date.now() - MIN_AGE_MS)
    const orphans = await db
      .select({ key: listingUploads.key })
      .from(listingUploads)
      .where(
        and(
          lt(listingUploads.createdAt, cutoff),
          notExists(
            db.select({ one: sql`1` }).from(listings).where(sql`${listingUploads.key} = ANY(${listings.photoKeys})`)
          )
        )
      )
      .limit(BATCH)

    let deleted = 0
    const gone: string[] = []
    for (const { key } of orphans) {
      if (await deleteFromR2(key)) { gone.push(key); deleted++ }
    }
    if (gone.length) await db.delete(listingUploads).where(inArray(listingUploads.key, gone))

    return NextResponse.json({ checked: orphans.length, deleted, moreRemaining: orphans.length === BATCH })
  } catch (err) {
    return handleApiError(err, { route: 'cron/cleanup-uploads' })
  }
}
