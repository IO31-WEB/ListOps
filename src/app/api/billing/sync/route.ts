import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncPlanFromClerkMetadata } from '@/lib/user-service'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await syncPlanFromClerkMetadata(userId)
  return NextResponse.json({ planTier: tier ?? 'free', synced: !!tier })
}
