/**
 * Notifications API
 * GET /api/notifications
 * Returns recent activity for the logged-in user as notification items.
 * Pulls from real DB data — recent campaigns, plan changes, etc.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns, users } from '@/lib/db/schema'
import { eq, desc, gte } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ notifications: [] })

  try {
    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ notifications: [] })

    const notifications: Array<{
      id: string
      type: 'success' | 'info' | 'warning'
      title: string
      body: string
      createdAt: number
      read: boolean
      href: string
    }> = []

    // Recent completed campaigns (last 7 days)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentCampaigns = await db.query.campaigns.findMany({
      where: (c, { and, eq: eqFn, gte: gteFn }) =>
        and(eqFn(c.agentId, user.id), gteFn(c.createdAt, since), eqFn(c.status, 'complete')),
      with: { listing: true },
      orderBy: [desc(campaigns.createdAt)],
      limit: 5,
    })

    for (const campaign of recentCampaigns) {
      const address = campaign.listing?.address ?? 'Your listing'
      notifications.push({
        id: `campaign_${campaign.id}`,
        type: 'success',
        title: 'Campaign ready',
        body: `${address} — 6-week campaign is ready to use.`,
        createdAt: campaign.createdAt.getTime(),
        read: false,
        href: `/dashboard/campaigns/${campaign.id}`,
      })
    }

    // Welcome notification for new users (account < 7 days old)
    const accountAge = Date.now() - user.createdAt.getTime()
    if (accountAge < 7 * 24 * 60 * 60 * 1000) {
      notifications.push({
        id: 'welcome',
        type: 'info',
        title: 'Welcome to ListOps',
        body: 'Generate your first campaign to get started.',
        createdAt: user.createdAt.getTime(),
        read: true,
        href: '/dashboard/generate',
      })
    }

    return NextResponse.json({ notifications })
  } catch (err) {
    console.error('[notifications] Error:', err)
    return NextResponse.json({ notifications: [] })
  }
}
