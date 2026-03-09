/**
 * Campaigns List API
 *
 * FIX: Added hard cap on `limit` param.
 * Previously ?limit=999999 would load millions of rows into memory.
 * Now capped at 100. Default remains 20.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserCampaigns } from '@/lib/user-service'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  // FIX: Cap limit at 100 — getUserCampaigns also enforces this, belt-and-suspenders
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '20')), 100)

  const result = await getUserCampaigns(userId, page, limit)
  return NextResponse.json(result)
}
