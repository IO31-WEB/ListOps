/**
 * GET /api/cron/daily — the ONE scheduled entry point in vercel.json (Vercel's Hobby plan allows very few cron jobs,
 * so everything runs from here). Order matters: send follow-ups first, then housekeeping.
 * Runs ~14:00 UTC = 9–10 am US Eastern, a sensible time for B2B follow-ups to land.
 * Each task is isolated: one failing never stops the others. Each task's own route stays available for manual runs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron-auth'
import { processDueOutreach } from '@/lib/outreach'
import { GET as cleanupUploads } from '../cleanup-uploads/route'
import { GET as retention } from '../retention/route'
import { captureError } from '@/lib/monitoring'
import { sendSocialDigests } from '@/lib/social/digest'
import { resetStaleUsageCounters } from '@/lib/user-service'

export const maxDuration = 300

async function task(name: string, fn: () => Promise<unknown>) {
  try { return await fn() } catch (err) { captureError(err, { cron: name }); return { error: 'failed' } }
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const outreach = await task('send-outreach', () => processDueOutreach())
  const social = await task('social-digest', () => sendSocialDigests())
  const uploads = await task('cleanup-uploads', async () => (await cleanupUploads(request)).json())
  const retained = await task('retention', async () => (await retention(request)).json())
  const usage = await task('usage-reset', () => resetStaleUsageCounters())
  const failed = [outreach, social, uploads, retained, usage].some(r => !!r && typeof r === 'object' && 'error' in (r as object))
  // 500 when any task failed so Vercel's cron log shows a failure (details are already in Sentry); the other tasks still ran.
  return NextResponse.json({ ok: !failed, outreach, social, uploads, retention: retained, usage }, { status: failed ? 500 : 200 })
}
