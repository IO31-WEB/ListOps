import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { qrCodes, qrScans } from '@/lib/db/schema'
import { dayKey } from '@/lib/performance/stats'
import { newQrCode, type QrPlacement } from './codes'

/** Returns the campaign's code for a placement, creating it on first use. Race-safe (unique index + re-read). */
export async function getOrCreateQr(campaignId: string, agentId: string, placement: QrPlacement) {
  const find = () => db.query.qrCodes.findFirst({ where: and(eq(qrCodes.campaignId, campaignId), eq(qrCodes.placement, placement)) })
  const existing = await find()
  if (existing) return existing
  for (let attempt = 0; attempt < 4; attempt++) {
    const [row] = await db.insert(qrCodes).values({ campaignId, agentId, placement, code: newQrCode() }).onConflictDoNothing().returning()
    if (row) return row
    const again = await find()   // lost the race on (campaign, placement), or (very rarely) the code collided → retry
    if (again) return again
  }
  throw new Error('Could not allocate a QR code')
}

/** Atomic per-day counter. Never throws. */
export async function recordScan(qrId: string): Promise<void> {
  try {
    await db.insert(qrScans).values({ qrId, day: dayKey(), count: 1 })
      .onConflictDoUpdate({ target: [qrScans.qrId, qrScans.day], set: { count: sql`${qrScans.count} + 1` } })
  } catch (err) {
    console.error('[qr] recordScan failed', err)
  }
}
