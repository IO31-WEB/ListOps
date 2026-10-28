/** GET/PUT /api/leads/settings — where lead alerts go (email override, SMS, signed webhook). Owner only. */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { db } from '@/lib/db'
import { leadSettings } from '@/lib/db/schema'
import { canAccess } from '@/lib/plans'
import { loadLeadContext } from '@/lib/leads/context'
import { normalizePhone } from '@/lib/leads/sanitize'
import { validateWebhookUrl } from '@/lib/leads/webhook'
import { smsConfigured } from '@/lib/leads/sms'

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

const Body = z.object({
  notifyEmail: z.preprocess(blankToNull, z.string().trim().toLowerCase().email().max(200).nullable()).optional(),
  smsEnabled: z.boolean().optional(),
  smsPhone: z.preprocess(blankToNull, z.string().max(40).nullable()).optional(),
  webhookUrl: z.preprocess(blankToNull, z.string().max(500).nullable()).optional(),
  rotateSecret: z.boolean().optional(),
})

async function view(userId: string, plan: Parameters<typeof canAccess>[0]) {
  const s = await db.query.leadSettings.findFirst({ where: eq(leadSettings.userId, userId) })
  return {
    notifyEmail: s?.notifyEmail ?? '',
    smsEnabled: s?.smsEnabled ?? false,
    smsPhone: s?.smsPhone ?? '',
    webhookUrl: s?.webhookUrl ?? '',
    webhookSecret: s?.webhookUrl ? s.webhookSecret ?? '' : '',
    capabilities: {
      export: canAccess(plan, 'lead_export'),
      webhook: canAccess(plan, 'lead_webhook'),
      sms: canAccess(plan, 'lead_sms'),
      smsConfigured: smsConfigured(),
    },
  }
}

export async function GET() {
  try {
    const clerkId = await requireUserId()
    const { user, plan } = await loadLeadContext(clerkId)
    return NextResponse.json(await view(user.id, plan), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleApiError(err, { route: 'leads/settings.get' })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const { user, plan } = await loadLeadContext(clerkId)
    const body = Body.parse(await readJson(request, 4 * 1024))
    const existing = await db.query.leadSettings.findFirst({ where: eq(leadSettings.userId, user.id) })

    const patch: Partial<typeof leadSettings.$inferInsert> = { updatedAt: new Date() }
    if (body.notifyEmail !== undefined) patch.notifyEmail = body.notifyEmail

    if (body.webhookUrl !== undefined) {
      if (body.webhookUrl === null) {
        patch.webhookUrl = null
        patch.webhookSecret = null
      } else {
        if (!canAccess(plan, 'lead_webhook')) throw new ApiError(403, 'Webhooks are available on the Pro plan and above.')
        const check = validateWebhookUrl(body.webhookUrl)
        if (!check.ok) throw new ApiError(400, check.reason)
        patch.webhookUrl = check.url.toString()
        if (!existing?.webhookSecret || body.rotateSecret) patch.webhookSecret = `whsec_${randomBytes(24).toString('hex')}`
      }
    } else if (body.rotateSecret && existing?.webhookUrl) {
      patch.webhookSecret = `whsec_${randomBytes(24).toString('hex')}`
    }

    if (body.smsPhone !== undefined) {
      if (body.smsPhone === null) patch.smsPhone = null
      else {
        const phone = normalizePhone(body.smsPhone)
        if (!phone) throw new ApiError(400, 'Enter a valid mobile number.')
        patch.smsPhone = phone
      }
    }
    if (body.smsEnabled !== undefined) {
      if (body.smsEnabled) {
        if (!canAccess(plan, 'lead_sms')) throw new ApiError(403, 'SMS alerts are available on the Pro plan and above.')
        if (!smsConfigured()) throw new ApiError(400, 'SMS alerts are not enabled on this server yet.')
        if (!(patch.smsPhone ?? existing?.smsPhone)) throw new ApiError(400, 'Add your mobile number first.')
      }
      patch.smsEnabled = body.smsEnabled
    }

    await db.insert(leadSettings).values({ userId: user.id, ...patch }).onConflictDoUpdate({ target: leadSettings.userId, set: patch })
    return NextResponse.json(await view(user.id, plan))
  } catch (err) {
    return handleApiError(err, { route: 'leads/settings.put' })
  }
}
