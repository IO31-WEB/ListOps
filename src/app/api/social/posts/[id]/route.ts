/** PATCH/DELETE /api/social/posts/[id] — edit text, reschedule (agent-local time), change status, add notes, remove. Owner only. */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { db } from '@/lib/db'
import { socialPosts } from '@/lib/db/schema'
import { loadSocialContext } from '@/lib/social/context'
import { zonedToUtc } from '@/lib/social/time'
import { cleanMessage } from '@/lib/leads/sanitize'

const Id = z.string().uuid()
const Body = z.object({
  body: z.string().transform(s => cleanMessage(s, 5000)).pipe(z.string().min(1)).optional(),
  scheduledLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional(),   // from <input type="datetime-local">, in the agent's time zone
  status: z.enum(['draft', 'scheduled', 'posted', 'skipped']).optional(),
  notes: z.string().max(500).transform(s => s.trim()).optional(),
}).refine(v => Object.keys(v).length > 0, 'Nothing to update')

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const id = Id.parse((await params).id)
    const { user, tz } = await loadSocialContext(clerkId)
    const b = Body.parse(await readJson(request, 12 * 1024))

    const patch: Partial<typeof socialPosts.$inferInsert> = { updatedAt: new Date() }
    if (b.body !== undefined) { patch.body = b.body; patch.reminderSentAt = null }
    if (b.scheduledLocal) {
      const [d, t] = b.scheduledLocal.split('T')
      const when = zonedToUtc(d, t, tz)
      if (Number.isNaN(when.getTime())) throw new ApiError(400, 'Invalid date')
      patch.scheduledFor = when; patch.reminderSentAt = null
    }
    if (b.status) { patch.status = b.status; patch.postedAt = b.status === 'posted' ? new Date() : null }
    if (b.notes !== undefined) patch.notes = b.notes || null

    const updated = await db.update(socialPosts).set(patch).where(and(eq(socialPosts.id, id), eq(socialPosts.agentId, user.id))).returning({ id: socialPosts.id })
    if (updated.length === 0) throw new ApiError(404, 'Post not found')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'social/posts.patch' })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const id = Id.parse((await params).id)
    const { user } = await loadSocialContext(clerkId)
    const removed = await db.delete(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.agentId, user.id))).returning({ id: socialPosts.id })
    if (removed.length === 0) throw new ApiError(404, 'Post not found')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'social/posts.delete' })
  }
}
