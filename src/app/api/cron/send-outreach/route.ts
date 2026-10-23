/** GET /api/cron/send-outreach — sends due outreach follow-up emails. (Also run by /api/cron/daily.) */
import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron-auth'
import { processDueOutreach } from '@/lib/outreach'
import { handleApiError } from '@/lib/api-utils'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await processDueOutreach()) })
  } catch (err) {
    return handleApiError(err, { route: 'cron/send-outreach' })
  }
}
