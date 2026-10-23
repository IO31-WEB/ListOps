/** GET /api/team/export — CSV of every campaign created by the signed-in admin's organization (Brokerage+, owner/admin only). */
import { NextResponse } from 'next/server'
import { getOrgCampaignExportRows, getTeamAdminContext, csvCell } from '@/lib/team-data'
import { rateLimitPdf, rateLimitHeaders } from '@/lib/ratelimit'
import { handleApiError } from '@/lib/api-utils'

export async function GET() {
  try {
    const ctx = await getTeamAdminContext()
    if (!ctx) return NextResponse.json({ error: 'Not available on your plan or role.' }, { status: 403 })
    const rl = await rateLimitPdf(ctx.clerkId) // same expensive-operation limiter (10 / 10 min)
    if (!rl.success) return NextResponse.json({ error: 'Too many exports. Please wait a few minutes.' }, { status: 429, headers: rateLimitHeaders(rl) })

    const rows = await getOrgCampaignExportRows(ctx.orgId)
    const head = ['Created (UTC)', 'Agent', 'Address', 'City', 'State', 'List price', 'Status', 'Microsite published', 'Microsite views']
    const lines = [head.join(',')].concat(
      rows.map(r => [r.createdAt, r.agentEmail, r.address, r.city, r.state, r.price, r.status, r.micrositePublished ? 'yes' : 'no', r.views ?? 0].map(csvCell).join(','))
    )
    return new NextResponse('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="listops-campaigns-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return handleApiError(err, { route: 'team/export' })
  }
}
