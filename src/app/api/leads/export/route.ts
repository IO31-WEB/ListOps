/** GET /api/leads/export?listing=<uuid>&status=<s> — CSV of the signed-in agent's leads (Pro+). */
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { handleApiError, requireUserId } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { formatListingAddress } from '@/lib/address'
import { LEAD_STATUSES } from '@/lib/leads/input'
import { leadsToCsv } from '@/lib/leads/csv'
import { loadLeadContext, requireFeature } from '@/lib/leads/context'

const Query = z.object({
  listing: z.string().uuid().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const clerkId = await requireUserId()
    const { user, plan } = await loadLeadContext(clerkId)
    requireFeature(plan, 'lead_export', 'CSV export is available on the Pro plan and above.')
    const sp = request.nextUrl.searchParams
    const q = Query.parse({ listing: sp.get('listing') ?? undefined, status: sp.get('status') ?? undefined })

    const conds: SQL[] = [eq(leads.agentId, user.id)]
    if (q.listing) conds.push(eq(leads.listingId, q.listing))
    if (q.status) conds.push(eq(leads.status, q.status))
    const rows = await db.query.leads.findMany({
      where: and(...conds), with: { listing: true }, orderBy: [desc(leads.createdAt)], limit: 5000,
    })
    const csv = leadsToCsv(rows.map(r => ({
      createdAt: r.createdAt, kind: r.kind, status: r.status, name: r.name, email: r.email, phone: r.phone,
      property: formatListingAddress(r.listing), preferredDate: r.preferredDate, preferredTime: r.preferredTime,
      message: r.message, source: r.source, medium: r.medium, campaignTag: r.campaignTag, referrerHost: r.referrerHost,
      consentAt: r.consentAt,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="listops-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return handleApiError(err, { route: 'leads/export' })
  }
}
