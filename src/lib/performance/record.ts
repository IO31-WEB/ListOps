import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignEvents } from '@/lib/db/schema'
import { dayKey, type EventKind } from './stats'

/** Atomically bumps today's counter. Never throws — tracking must not break the page that triggered it. */
export async function recordEvent(campaignId: string, kind: EventKind): Promise<void> {
  try {
    await db.insert(campaignEvents).values({ campaignId, day: dayKey(), kind, count: 1 })
      .onConflictDoUpdate({ target: [campaignEvents.campaignId, campaignEvents.day, campaignEvents.kind], set: { count: sql`${campaignEvents.count} + 1` } })
  } catch (err) {
    console.error('[performance] recordEvent failed', kind, err)
  }
}
