import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Users } from 'lucide-react'
import { describeInvite, acceptTeamInvite } from '@/lib/team-invites'
import { ensureDbUser } from '@/lib/ensure-user'
import { rateLimitJoin } from '@/lib/ratelimit'
import { logAudit } from '@/lib/audit'
import { isPlausibleToken } from '@/lib/team-invite-rules'

export const metadata = { title: 'Join your team', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-amber-100/80 p-8 space-y-4">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center"><Users className="w-6 h-6 text-amber-600" /></div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">{title}</h1>
        {children}
      </div>
    </main>
  )
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const info = isPlausibleToken(token) ? await describeInvite(token) : null
  if (!info) return <Card title="Invite not found"><p className="text-sm text-slate-600">This invite link is not valid. Ask your team owner to send a new one.</p><Link href="/" className="text-sm underline text-amber-700">Back to ListOps</Link></Card>

  const { userId } = await auth()

  if (!userId) {
    if (!info.usable) {
      return <Card title={info.status === 'accepted' ? 'Invite already used' : 'Invite no longer valid'}><p className="text-sm text-slate-600">This invite has {info.status === 'revoked' ? 'been cancelled' : info.status === 'accepted' ? 'already been used' : 'expired'}. Ask {info.inviterName} to send a new one.</p></Card>
    }
    return (
      <Card title={`${info.inviterName} invited you`}>
        <p className="text-sm text-slate-600">Join <strong>{info.orgName}</strong> on ListOps as {info.role === 'admin' ? 'an admin' : `a${info.role === 'agent' ? 'n agent' : ' viewer'}`}. You will get the team&apos;s plan while the team&apos;s subscription is active.</p>
        <p className="text-xs text-slate-500">Use the email address this invite was sent to: <strong>{info.email}</strong>. The link works once.</p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href={`/sign-up?invite=${encodeURIComponent(token)}`} className="flex-1 text-center bg-slate-900 text-white font-semibold py-3 rounded-xl">Create account</Link>
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`} className="flex-1 text-center border border-slate-300 text-slate-800 font-semibold py-3 rounded-xl">I have an account</Link>
        </div>
      </Card>
    )
  }

  // Signed in: accept. Everything below is decided server-side; nothing from the browser is trusted beyond the token.
  const me = await ensureDbUser()
  if (!me) return <Card title="Could not load your account"><p className="text-sm text-slate-600">Please refresh in a moment.</p></Card>
  const rl = await rateLimitJoin(me.clerkId)
  if (!rl.success) return <Card title="Too many attempts"><p className="text-sm text-slate-600">Please wait a few minutes and open the link again.</p></Card>

  const result = await acceptTeamInvite(me.user, me.verifiedEmail, token)
  if (result.ok) {
    if (!result.already) await logAudit({ action: 'team.invite_accepted', actorClerkId: me.clerkId, targetUserId: me.user.id, metadata: { orgId: result.orgId } })
    redirect('/dashboard')
  }
  return (
    <Card title="We couldn't add you to the team">
      <p role="alert" className="text-sm text-slate-700">{result.error}</p>
      <div className="flex gap-3 pt-2">
        <Link href="/dashboard" className="bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">Go to dashboard</Link>
        {result.code === 'email_mismatch' && <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`} className="border border-slate-300 text-slate-800 font-semibold px-5 py-2.5 rounded-xl text-sm">Use a different account</Link>}
      </div>
    </Card>
  )
}
