import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { qrCodes, qrScans } from '@/lib/db/schema'
import { dayKey, fillDaily, sum } from '@/lib/performance/stats'
import { QR_PLACEMENTS, type QrPlacement } from './codes'

export interface QrRow { placement: QrPlacement; code: string | null; scans30: number; scansAll: number; firstScanDay: string | null }

/** One row per placement (code null until created) with real scan counts. */
export async function loadQrRows(campaignId: string): Promise<QrRow[]> {
  const codes = await db.query.qrCodes.findMany({ where: eq(qrCodes.campaignId, campaignId) })
  const scans = codes.length ? await db.select().from(qrScans).where(inArray(qrScans.qrId, codes.map(c => c.id))) : []
  const since = fillDaily([], 30, dayKey())[0].day
  return QR_PLACEMENTS.map(placement => {
    const c = codes.find(x => x.placement === placement)
    const mine = c ? scans.filter(s => s.qrId === c.id) : []
    return {
      placement, code: c?.code ?? null,
      scans30: sum(mine.filter(s => s.day >= since)), scansAll: sum(mine),
      firstScanDay: mine.length ? mine.map(s => s.day).sort()[0] : null,
    }
  })
}
