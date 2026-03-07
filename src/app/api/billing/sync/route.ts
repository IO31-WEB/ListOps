import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncPlanFromClerkMetadata } from '@/lib/user-service'

// GET: hit this URL in a browser tab to force-sync your Clerk plan to DB
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await syncPlanFromClerkMetadata(userId)
  return NextResponse.json({ planTier: tier ?? 'free', synced: !!tier, message: tier ? `Synced plan: ${tier}` : 'No plan found in Clerk metadata' })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await syncPlanFromClerkMetadata(userId)
  return NextResponse.json({ planTier: tier ?? 'free', synced: !!tier })
}
