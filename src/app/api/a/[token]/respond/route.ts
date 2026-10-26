/**
 * POST /api/a/[token]/respond — PUBLIC. The seller submits Approve / Request-changes for every item.
 * Protection: 192-bit revocable token, per-IP + per-token rate limits, strict zod body checked against the stored snapshot,
 * and the agent must still be on a plan that includes seller approvals. Stores the typed name + time, no IP or device.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { rateLimitApproval, rateLimitHeaders } from '@/lib/ratelimit'
import { db } from '@/lib/db'
import { approvalRequests, approvalResponses } from '@/lib/db/schema'
import { canAccess } from '@/lib/plans'
import { getPlanTierForUserId } from '@/lib/user-service'
import { TOKEN_RE } from '@/lib/performance/stats'
import { validateSubmission } from '@/lib/approval/items'
import { notifyAgentOfResponse } from '@/lib/approval/notify'

const text = (max: number) => z.string().transform(s => s.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max))
const Body = z.object({
  signedName: text(80).pipe(z.string().min(2, 'Please type your full name.')),
  responses: z.array(z.object({
    key: z.string().min(1).max(80),
    decision: z.enum(['approved', 'changes']),
    comment: text(1000).optional(),
  })).min(1).max(60),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    if (!TOKEN_RE.test(token)) throw new ApiError(404, 'This link is not valid.')
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const [a, b] = await Promise.all([rateLimitApproval(`ip:${ip}`), rateLimitApproval(`tok:${token}`)])
    if (!a.success || !b.success) throw new ApiError(429, 'Too many attempts. Please wait a few minutes and try again.', rateLimitHeaders(a.success ? b : a))

    const body = Body.parse(await readJson(request, 64 * 1024))
    const req = await db.query.approvalRequests.findFirst({ where: and(eq(approvalRequests.token, token), isNull(approvalRequests.revokedAt)) })
    if (!req || !canAccess(await getPlanTierForUserId(req.agentId), 'seller_approval')) throw new ApiError(404, 'This link is not valid or has been replaced.')

    const problem = validateSubmission(req.items, body.responses)
    if (problem) throw new ApiError(400, problem)

    const now = new Date()
    await db.insert(approvalResponses).values(body.responses.map(r => ({
      requestId: req.id, itemKey: r.key, decision: r.decision, comment: r.decision === 'changes' ? (r.comment ?? '') : null, signedName: body.signedName, decidedAt: now,
    }))).onConflictDoUpdate({
      target: [approvalResponses.requestId, approvalResponses.itemKey],
      set: { decision: sql`excluded.decision`, comment: sql`excluded.comment`, signedName: sql`excluded.signed_name`, decidedAt: sql`excluded.decided_at` },
    })
    await db.update(approvalRequests).set({ submittedAt: now }).where(eq(approvalRequests.id, req.id))
    after(() => notifyAgentOfResponse(req.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'a/respond' })
  }
}
