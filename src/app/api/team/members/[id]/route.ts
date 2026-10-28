/** DELETE /api/team/members/:id — remove a member (owner/admin). The member keeps their own content and gets a free solo workspace; the seat is freed. */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getUserWithDetails } from '@/lib/user-service'
import { removeTeamMember } from '@/lib/team-invites'
import { logAudit } from '@/lib/audit'
import { assertSameOrigin } from '@/lib/admin'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(req) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = z.string().uuid().safeParse((await params).id)
  if (!id.success) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const actor = await getUserWithDetails(userId)
  if (!actor || actor.deletedAt) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const res = await removeTeamMember({ id: actor.id, orgId: actor.orgId, role: actor.role }, id.data)
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: res.status })
  await logAudit({ action: 'team.member_removed', actorClerkId: userId, targetUserId: id.data, request: req })
  return NextResponse.json({ success: true })
}
