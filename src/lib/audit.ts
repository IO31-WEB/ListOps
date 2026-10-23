/**
 * Audit logging for sensitive actions (admin actions, deletions, plan/quota changes, consent records).
 * Writes to the existing `audit_logs` table. Best-effort: a logging failure never breaks the user's request,
 * but is reported to Sentry. Never put secrets, tokens, photo contents or full message bodies in `metadata`.
 */
import { isIP } from 'net'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { writeAuditLog } from '@/lib/user-service'
import { captureError } from '@/lib/monitoring'

export type AuditAction =
  | 'admin.search_users' | 'admin.view_user' | 'admin.view_as_user' | 'admin.quota_adjust' | 'admin.delete_account'
  | 'user.age_confirmed' | 'user.age_blocked' | 'user.deleted' | 'listing.deleted' | 'billing.checkout_started'
  | 'team.invite_sent' | 'outreach.batch_sent' | 'outreach.cancelled'

export function requestIp(request?: Request): string | undefined {
  const raw = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return raw && isIP(raw) ? raw : undefined // `ip_address` is an inet column — never pass garbage
}

export async function logAudit(opts: {
  action: AuditAction
  /** Clerk id of whoever did it (admin or the user themselves) */
  actorClerkId: string
  actorEmail?: string
  /** DB id (uuid) of the user the action is about, if any */
  targetUserId?: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  request?: Request
}): Promise<void> {
  try {
    const actor = await db.query.users.findFirst({ where: eq(users.clerkId, opts.actorClerkId), columns: { id: true, orgId: true } })
    await writeAuditLog({
      userId: actor?.id,
      orgId: actor?.orgId ?? undefined,
      action: opts.action,
      resourceType: opts.resourceType ?? (opts.targetUserId ? 'user' : undefined),
      resourceId: opts.resourceId ?? opts.targetUserId,
      metadata: { actorClerkId: opts.actorClerkId, actorEmail: opts.actorEmail, ...opts.metadata },
      ipAddress: requestIp(opts.request),
      userAgent: opts.request?.headers.get('user-agent')?.slice(0, 300),
    })
  } catch (err) {
    captureError(err, { context: 'audit_log', action: opts.action })
  }
}
