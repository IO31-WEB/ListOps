/**
 * Notifications API
 *   GET  /api/notifications       recent activity as notification items, with server-side read state
 *   POST /api/notifications/seen  (see ./seen/route.ts) marks everything up to now as read
 *
 * Read state is a single "last opened the bell" timestamp on the user (users.notifications_seen_at), so a badge
 * cleared on one device is cleared on all of them and cannot come back after browser storage is wiped.
 * Only the last NOTIFICATION_MAX_AGE_DAYS days are returned; older items simply aren't shown.
 */

import { formatStreet } from '@/lib/address'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'

const NOTIFICATION_MAX_AGE_DAYS = 3
const DAY = 24 * 60 * 60 * 1000

export interface NotificationItem {
  id: string
  type: 'success' | 'info' | 'warning'
  title: string
  body: string
  createdAt: number
  read: boolean
  href: string
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ notifications: [], seenAt: 0 })

  try {
    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ notifications: [], seenAt: 0 })

    const seenAt = (user as any).notificationsSeenAt instanceof Date ? ((user as any).notificationsSeenAt as Date).getTime() : 0
    const since = new Date(Date.now() - NOTIFICATION_MAX_AGE_DAYS * DAY)
    const notifications: NotificationItem[] = []

    const recentCampaigns = await db.query.campaigns.findMany({
      where: (c, { and, eq: eqFn, gte: gteFn }) =>
        and(eqFn(c.agentId, user.id), gteFn(c.createdAt, since), eqFn(c.status, 'complete')),
      with: { listing: true },
      orderBy: [desc(campaigns.createdAt)],
      limit: 5,
    })

    for (const campaign of recentCampaigns) {
      const address = campaign.listing?.address ? formatStreet(campaign.listing.address) : 'Your listing'
      const createdAt = campaign.createdAt.getTime()
      notifications.push({
        id: `campaign_${campaign.id}`,
        type: 'success',
        title: 'Campaign ready',
        body: `${address} — 6-week campaign is ready to use.`,
        createdAt,
        read: createdAt <= seenAt,
        href: `/dashboard/campaigns/${campaign.id}`,
      })
    }

    // Welcome note — only while the account is new (same window as everything else).
    if (user.createdAt.getTime() > since.getTime()) {
      const createdAt = user.createdAt.getTime()
      notifications.push({
        id: 'welcome',
        type: 'info',
        title: 'Welcome to ListOps',
        body: 'Generate your first campaign to get started.',
        createdAt,
        read: createdAt <= seenAt,
        href: '/dashboard/generate',
      })
    }

    notifications.sort((a, b) => b.createdAt - a.createdAt)
    return NextResponse.json({ notifications, seenAt })
  } catch (err) {
    console.error('[notifications] Error:', err)
    return NextResponse.json({ notifications: [], seenAt: 0 })
  }
}
