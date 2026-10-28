/** GET /api/social/export?format=csv|ics — the agent's queue as a spreadsheet or calendar file (excludes skipped posts). */
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { handleApiError, requireUserId } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { socialPosts } from '@/lib/db/schema'
import { formatListingAddress } from '@/lib/address'
import { resolveListingPhotos } from '@/lib/photos'
import { loadSocialContext } from '@/lib/social/context'
import { postsToCsv, postsToIcs, type ExportPost } from '@/lib/social/export'

const Query = z.object({ format: z.enum(['csv', 'ics']).default('csv') })
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/+$/, '')

export async function GET(request: NextRequest) {
  try {
    const clerkId = await requireUserId()
    const { user, tz } = await loadSocialContext(clerkId)
    const { format } = Query.parse({ format: request.nextUrl.searchParams.get('format') ?? undefined })
    const rows = await db.query.socialPosts.findMany({
      where: and(eq(socialPosts.agentId, user.id), ne(socialPosts.status, 'skipped')),
      with: { campaign: { with: { listing: true } } }, orderBy: [asc(socialPosts.scheduledFor)], limit: 2000,
    })
    const posts: ExportPost[] = rows.map(r => {
      const photo = r.campaign?.listing ? resolveListingPhotos(r.campaign.listing)[0] : undefined
      return {
        id: r.id, channel: r.channel, status: r.status, body: r.body, scheduledFor: r.scheduledFor,
        property: formatListingAddress(r.campaign?.listing) || 'Listing',
        imageUrl: photo ? (/^https?:\/\//.test(photo) ? photo : `${appUrl()}${photo}`) : null,
        link: r.campaign?.micrositeSlug && r.campaign.micrositePublished ? `${appUrl()}/l/${r.campaign.micrositeSlug}` : null,
      }
    })
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(format === 'ics' ? postsToIcs(posts) : postsToCsv(posts, tz), {
      headers: {
        'Content-Type': format === 'ics' ? 'text/calendar; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="listops-social-${stamp}.${format}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return handleApiError(err, { route: 'social/export' })
  }
}
