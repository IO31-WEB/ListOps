/** POST /api/notifications/seen — the user opened the bell: everything so far counts as read, on every device. */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  try {
    await db.update(users).set({ notificationsSeenAt: now }).where(eq(users.clerkId, userId))
    return NextResponse.json({ seenAt: now.getTime() })
  } catch (err) {
    console.error('[notifications/seen] Error:', err)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
}
