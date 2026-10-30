'use client'

import { useState, useEffect } from 'react'
import { Gift, Copy, Check, Users, DollarSign, ArrowRight, Share2, Twitter, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

interface ReferralData {
  code: string
  referralUrl: string
  stats: { total: number; signedUp: number; upgraded: number; rewardsEarned: number }
  earnings?: { holdCents: number; payableCents: number; paidCents: number; payoutEmail: string | null; ratePct: number; holdDays: number }
}

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [payoutEmail, setPayoutEmail] = useState('')
  const [savingPayout, setSavingPayout] = useState(false)

  useEffect(() => {
    fetch('/api/referral')
      .then(r => r.json())
      .then(d => { setData(d); setPayoutEmail(d?.earnings?.payoutEmail ?? ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const savePayoutEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPayout(true)
    try {
      const res = await fetch('/api/referral/payout-email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payoutEmail }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not save')
      toast.success('Payout email saved')
    } catch (err: any) { toast.error(err.message || 'Could not save') }
    finally { setSavingPayout(false) }
  }

  const copyLink = () => {
    if (!data?.referralUrl) return
    navigator.clipboard.writeText(data.referralUrl)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareTwitter = () => {
    if (!data?.referralUrl) return
    const text = encodeURIComponent(`I use ListOps to generate 6-week real estate campaigns in 90 seconds. Check it out:`)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(data.referralUrl)}`, '_blank')
  }

  const shareEmail = () => {
    if (!data?.referralUrl) return
    const subject = encodeURIComponent('Try ListOps — AI real estate marketing in 90s')
    const body = encodeURIComponent(`Hey,\n\nI've been using ListOps to generate complete 6-week marketing campaigns for my listings in about 90 seconds. Facebook posts, Instagram captions, flyers, email copy — all done.\n\nSign up with my link and you can try it free:\n${data.referralUrl}\n\nHope it helps!`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="h-40 bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Refer & Earn</h1>
        <p className="text-sm text-slate-500 mt-1">Share ListOps with fellow agents — you both win.</p>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold text-slate-900">How it works</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: '1', text: 'Share your unique link with another agent' },
            { step: '2', text: 'They sign up and upgrade to any paid plan' },
            { step: '3', text: `You earn ${data?.earnings?.ratePct ?? 20}% of what they pay, paid out to you by our team` },
          ].map(({ step, text }) => (
            <div key={step} className="text-center">
              <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-bold text-sm flex items-center justify-center mx-auto mb-2">{step}</div>
              <p className="text-xs text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Your link */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Your Referral Link</h2>
        <div className="flex gap-2">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 font-mono truncate">
            {data?.referralUrl ?? 'Loading...'}
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500">Share via:</span>
          <button onClick={shareTwitter} className="flex items-center gap-1.5 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-100 transition-all">
            <Twitter className="w-3.5 h-3.5" /> Twitter
          </button>
          <button onClick={shareEmail} className="flex items-center gap-1.5 text-xs bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all">
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
        </div>

        <div className="text-xs text-slate-400 pt-1">
          Your referral code: <span className="font-mono font-semibold text-slate-600">{data?.code}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Referred', value: data?.stats.total ?? 0, icon: Share2 },
          { label: 'Signed Up', value: data?.stats.signedUp ?? 0, icon: Users },
          { label: 'Upgraded', value: data?.stats.upgraded ?? 0, icon: ArrowRight },
          { label: 'Total Earned', value: usd((data?.earnings?.paidCents ?? 0) + (data?.earnings?.payableCents ?? 0) + (data?.earnings?.holdCents ?? 0)), icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Earnings + payout */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Your earnings</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Pending', value: usd(data?.earnings?.holdCents ?? 0), hint: `${data?.earnings?.holdDays ?? 30}-day hold` },
            { label: 'Ready to pay', value: usd(data?.earnings?.payableCents ?? 0), hint: 'next payout' },
            { label: 'Paid', value: usd(data?.earnings?.paidCents ?? 0), hint: 'all time' },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-lg sm:text-xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs font-medium text-slate-600">{s.label}</div>
              <div className="text-[11px] text-slate-400">{s.hint}</div>
            </div>
          ))}
        </div>
        <form onSubmit={savePayoutEmail} className="flex flex-col sm:flex-row gap-2">
          <label className="sr-only" htmlFor="payout-email">Payout email</label>
          <input id="payout-email" type="email" inputMode="email" autoComplete="email" value={payoutEmail} onChange={e => setPayoutEmail(e.target.value)}
            placeholder="PayPal or Zelle email for payouts" className="flex-1 min-w-0 border border-slate-200 rounded-xl px-4 py-3 text-base sm:text-sm" />
          <button disabled={savingPayout} className="bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60">{savingPayout ? 'Saving…' : 'Save'}</button>
        </form>
        <p className="text-xs text-slate-400">Commission accrues on each payment your referral makes and becomes payable after the hold period. Payouts are sent manually, usually within a few business days of becoming payable. Refunded payments are not paid.</p>
      </div>

      {/* Terms */}
      <p className="text-xs text-slate-400 text-center pb-4">
        Stats update automatically: "Signed up" counts people who created an account from your link, and "Upgraded" counts only those whose own account has an active paid subscription. Teammates you invite to your team are not referrals. Free month credits are applied by our team after an upgrade.
      </p>
    </div>
  )
}
