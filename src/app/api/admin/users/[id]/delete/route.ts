/**
 * POST /api/admin/users/:id/delete — admin-only account closure (soft delete).
 * Sets users.deleted_at (blocks all access immediately), removes the Clerk login, and writes an audit entry.
 * The user's content is permanently purged 30 days later by /api/cron/retention. Requires typing the user's email.
 * Admin accounts cannot be deleted through this endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { ADMIN_EMAILS, assertSameOrigin, requireAdminApi } from '@/lib/admin'
import { logAudit } from '@/lib/audit'
import { rateLimitAdmin, rateLimitHeaders } from '@/lib/ratelimit'
import { captureError } from '@/lib/monitoring'

const Schema = z.object({ confirmEmail: z.string().trim().toLowerCase().email(), reason: z.string().trim().min(5).max(300) })

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const admin = await requireAdminApi()
    const rl = await rateLimitAdmin(admin.clerkId)
    if (!rl.success) throw new ApiError(429, 'Too many admin actions. Slow down.', rateLimitHeaders(rl))

    const { id } = await ctx.params
    const { confirmEmail, reason } = Schema.parse(await readJson(request, 2 * 1024))
    const target = await db.query.users.findFirst({
      where: eq(users.id, z.string().uuid().parse(id)),
      columns: { id: true, clerkId: true, email: true, deletedAt: true },
    })
    if (!target) throw new ApiError(404, 'User not found')
    if (ADMIN_EMAILS.includes(target.email.toLowerCase())) throw new ApiError(400, 'Admin accounts cannot be deleted here.')
    if (confirmEmail !== target.email.toLowerCase()) throw new ApiError(400, 'Confirmation email does not match.')
    if (target.deletedAt) throw new ApiError(409, 'This account is already closed.')

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, target.id))
    try {
      await (await clerkClient()).users.deleteUser(target.clerkId)
    } catch (err) {
      captureError(err, { context: 'admin_delete_clerk_user' }) // DB block already in place; finish manually in Clerk
    }
    await logAudit({
      action: 'admin.delete_account', actorClerkId: admin.clerkId, actorEmail: admin.email, targetUserId: target.id, request,
      metadata: { reason, targetEmail: target.email },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'admin/delete' })
  }
}
