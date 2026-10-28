import { redirect } from 'next/navigation'
import { ensureDbUser } from '@/lib/ensure-user'
import { claimReferral, normalizeReferralCode } from '@/lib/referrals'
import { rateLimitReferral } from '@/lib/ratelimit'
import { trackReferralSignup } from '@/lib/posthog'
import { logAudit } from '@/lib/audit'

export const metadata = { title: 'Welcome to ListOps', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Post-sign-up landing for shared referral links (/sign-up?ref=CODE -> here). Records the referral (so the referrer's
 * Total / Signed Up counters move), then continues to the dashboard, where the age + terms gate still applies.
 * Never blocks the new user: any failure just continues.
 */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const code = normalizeReferralCode((await searchParams).ref)
  if (code) {
    try {
      const me = await ensureDbUser()
      if (me && (await rateLimitReferral(me.clerkId)).success) {
        const res = await claimReferral(me.user, code)
        if (res.ok) {
          trackReferralSignup({ referrerId: res.referrerClerkId, newUserId: me.clerkId, referralCode: code })
          await logAudit({ action: 'referral.claimed', actorClerkId: me.clerkId, targetUserId: me.user.id })
        }
      }
    } catch (err) { console.error('[join] referral claim failed (non-fatal):', err) }
  }
  redirect('/dashboard')
}
