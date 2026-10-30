import Link from 'next/link'
import { formatListingAddress } from '@/lib/address'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin'
import { getViewAsUser } from '@/lib/admin-data'
import { logAudit } from '@/lib/audit'
import { Badge, Card, fmtDate, statusTone } from '../../../_lib'

export const dynamic = 'force-dynamic'

/**
 * "View as user" — a READ-ONLY snapshot of what this user sees (their plan, listings and campaigns).
 * Deliberately NOT Clerk impersonation: there is no way to act as the user, change their data, or see their
 * password/session. Every load writes an `admin.view_as_user` audit entry.
 */
export default async function ViewAsUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage()
  const { id } = await params
  const d = await getViewAsUser(id)
  if (!d) notFound()
  await logAudit({ action: 'admin.view_as_user', actorClerkId: admin.clerkId, actorEmail: admin.email, targetUserId: d.user.id, metadata: { targetEmail: d.user.email } })

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-3 sm:px-4 py-3 text-sm text-amber-900 break-words">
        <strong>Read-only admin view of {d.user.email}.</strong> This access has been recorded in the audit log. You cannot change anything from this page.
        {' '}<Link prefetch={false} className="underline inline-flex items-center min-h-10" href={`/admin/users/${d.user.id}`}>← Back to user</Link>
      </div>
      <Card title="Account as the user sees it">
        <p className="text-sm text-slate-700">Plan <Badge tone="slate">{d.plan}</Badge> · {d.usedThisPeriod} of {d.limit} generations used this month · {d.user.onboardingComplete ? 'onboarding complete' : 'onboarding NOT complete'}</p>
      </Card>
      <Card title={`Campaigns (latest ${d.campaignViews.length})`}>
        {d.campaignViews.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
          <div className="space-y-3 sm:space-y-4">{d.campaignViews.map(c => (
            <div key={c.id} className="rounded-lg border border-slate-200 p-3 sm:p-4 min-w-0 break-words">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm min-w-0 break-words">{formatListingAddress(c.listing) || 'Untitled listing'}</strong>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                <span className="text-xs text-slate-500">{fmtDate(c.createdAt)}</span>
              </div>
              {c.listing && <p className="text-xs text-slate-600 mt-1">{c.listing.price ? `$${Number(c.listing.price).toLocaleString()} · ` : ''}{c.listing.bedrooms ?? '–'} bd · {c.listing.bathrooms ?? '–'} ba · {c.listing.sqft ?? '–'} sqft · {(c.listing.photos ?? []).length} photos</p>}
              {c.failureReason && <p className="text-xs text-red-700 mt-1">Failure: {c.failureReason}</p>}
              <p className="text-xs text-slate-600 mt-2">{Object.entries(c.content).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
              {c.micrositePublished && c.micrositeSlug && <p className="text-xs mt-1">Public microsite: <a className="underline text-amber-700 break-all" href={`/l/${c.micrositeSlug}`} target="_blank" rel="noreferrer">/l/{c.micrositeSlug}</a> · {c.micrositeViews ?? 0} views</p>}
            </div>))}</div>
        )}
      </Card>
    </div>
  )
}
