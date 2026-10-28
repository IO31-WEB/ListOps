/** GET/PUT /api/social/settings — daily "posts due" email on/off. */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { db } from '@/lib/db'
import { socialSettings } from '@/lib/db/schema'
import { loadSocialContext } from '@/lib/social/context'

const Body = z.object({ digest: z.boolean() })

export async function GET() {
  try {
    const clerkId = await requireUserId()
    const { user } = await loadSocialContext(clerkId)
    const s = await db.query.socialSettings.findFirst({ where: eq(socialSettings.userId, user.id) })
    return NextResponse.json({ digest: s?.digest ?? true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleApiError(err, { route: 'social/settings.get' })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const { user } = await loadSocialContext(clerkId)
    const { digest } = Body.parse(await readJson(request, 512))
    await db.insert(socialSettings).values({ userId: user.id, digest }).onConflictDoUpdate({ target: socialSettings.userId, set: { digest, updatedAt: new Date() } })
    return NextResponse.json({ digest })
  } catch (err) {
    return handleApiError(err, { route: 'social/settings.put' })
  }
}
