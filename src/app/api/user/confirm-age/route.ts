/**
 * POST /api/user/confirm-age  { adult: boolean, acceptTerms: boolean }
 *
 * The authoritative, server-side age + terms record.
 *  - adult && acceptTerms  -> stores age_confirmed_at / terms_accepted_at / terms_version
 *  - !adult                -> stores age_blocked_at, then (best effort) deletes the Clerk account
 *                             so we do not keep an account for a minor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { getOrCreateUser } from '@/lib/user-service'
import { TERMS_VERSION } from '@/lib/legal'
import { captureError } from '@/lib/monitoring'

const Schema = z.object({ adult: z.boolean(), acceptTerms: z.boolean() })

export async function POST(request: NextRequest) {
  try {
    const clerkId = await requireUserId()
    const { adult, acceptTerms } = Schema.parse(await readJson(request, 1024))

    // The row may not exist yet right after sign-up (webhook race) — create it.
    let user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
    if (!user) {
      const cu = await currentUser()
      const email = cu?.emailAddresses[0]?.emailAddress
      if (!email) throw new ApiError(400, 'Your account has no email address.')
      await getOrCreateUser(clerkId, {
        email,
        firstName: cu?.firstName ?? undefined,
        lastName: cu?.lastName ?? undefined,
        avatarUrl: cu?.imageUrl,
      })
      user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
    }
    if (!user) throw new ApiError(500, 'Could not load your account.')

    if (!adult) {
      await db.update(users).set({ ageBlockedAt: new Date() }).where(eq(users.id, user.id))
      try {
        const client = await clerkClient()
        await client.users.deleteUser(clerkId)
      } catch (err) {
        // Not fatal: the account is already blocked in our DB and every API rejects it.
        captureError(err, { context: 'delete_underage_clerk_user' })
      }
      return NextResponse.json({ blocked: true })
    }

    if (user.ageBlockedAt) throw new ApiError(403, 'This account is not eligible to use ListOps.')
    if (!acceptTerms) throw new ApiError(400, 'You must accept the Terms of Service and Privacy Policy.')

    const now = new Date()
    await db
      .update(users)
      .set({ ageConfirmedAt: now, termsAcceptedAt: now, termsVersion: TERMS_VERSION })
      .where(eq(users.id, user.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'user/confirm-age' })
  }
}
