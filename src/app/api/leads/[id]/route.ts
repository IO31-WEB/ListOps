/** PATCH /api/leads/[id] — set status. DELETE — remove a lead. Owner only; same-origin only. */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { LeadStatusPatch } from '@/lib/leads/input'
import { loadLeadContext } from '@/lib/leads/context'

const Id = z.string().uuid()

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const id = Id.parse((await params).id)
    const { user } = await loadLeadContext(clerkId)
    const { status } = LeadStatusPatch.parse(await readJson(request, 1024))
    const updated = await db.update(leads).set({ status }).where(and(eq(leads.id, id), eq(leads.agentId, user.id))).returning({ id: leads.id })
    if (updated.length === 0) throw new ApiError(404, 'Lead not found')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'leads/patch' })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const id = Id.parse((await params).id)
    const { user } = await loadLeadContext(clerkId)
    const removed = await db.delete(leads).where(and(eq(leads.id, id), eq(leads.agentId, user.id))).returning({ id: leads.id })
    if (removed.length === 0) throw new ApiError(404, 'Lead not found')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'leads/delete' })
  }
}
