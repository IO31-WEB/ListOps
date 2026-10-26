/** GET /api/qr/[code]?download=1 — the code's print-ready SVG (owner only). Vector, so it stays sharp at any size. */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, requireUserId } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { CODE_RE, qrTargetUrl } from '@/lib/qr/codes'
import { qrSvg } from '@/lib/qr/encode'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const clerkId = await requireUserId()
    const code = z.string().regex(CODE_RE).parse((await params).code)
    const [qr, user] = await Promise.all([
      db.query.qrCodes.findFirst({ where: (t, { eq: e }) => e(t.code, code) }),
      db.query.users.findFirst({ where: eq(users.clerkId, clerkId), columns: { id: true } }),
    ])
    if (!qr || !user || qr.agentId !== user.id) throw new ApiError(404, 'Not found')
    const headers: Record<string, string> = { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'private, max-age=3600' }
    if (request.nextUrl.searchParams.get('download') === '1') headers['Content-Disposition'] = `attachment; filename="listops-qr-${qr.placement}.svg"`
    return new NextResponse(qrSvg(qrTargetUrl(qr.code)), { headers })
  } catch (err) {
    return handleApiError(err, { route: 'qr/svg' })
  }
}
