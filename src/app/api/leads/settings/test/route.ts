/** POST /api/leads/settings/test — sends a signed `lead.test` event to the saved webhook so the agent can verify it. */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { ApiError, handleApiError, requireUserId } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { db } from '@/lib/db'
import { leadSettings } from '@/lib/db/schema'
import { loadLeadContext, requireFeature } from '@/lib/leads/context'
import { deliverWebhook } from '@/lib/leads/webhook'

export async function POST(request: NextRequest) {
  try {
    const clerkId = await requireUserId()
    assertSameOrigin(request)
    const { user, plan } = await loadLeadContext(clerkId)
    requireFeature(plan, 'lead_webhook', 'Webhooks are available on the Pro plan and above.')
    const s = await db.query.leadSettings.findFirst({ where: eq(leadSettings.userId, user.id) })
    if (!s?.webhookUrl || !s.webhookSecret) throw new ApiError(400, 'Save a webhook URL first.')
    const now = new Date().toISOString()
    const r = await deliverWebhook({
      url: s.webhookUrl, secret: s.webhookSecret,
      payload: {
        event: 'lead.test', id: '00000000-0000-0000-0000-000000000000', createdAt: now, type: 'showing',
        name: 'Test Lead', email: 'test@example.com', phone: '+15555550123', message: 'This is a test event from ListOps.',
        preferredDate: null, preferredTime: 'anytime',
        consent: { given: true, text: 'Test event', at: now },
        source: { source: 'test', medium: null, campaign: null, referrerHost: null },
        property: { address: '123 Example St, Anytown, ST', price: 450000, micrositeUrl: null }, campaignId: null,
      },
    })
    return NextResponse.json(r.ok ? { ok: true, status: r.status } : { ok: false, reason: r.reason })
  } catch (err) {
    return handleApiError(err, { route: 'leads/settings.test' })
  }
}
