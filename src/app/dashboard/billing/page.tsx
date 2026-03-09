'use client'

import { useState, useEffect } from 'react'
import { Check, X, Zap, CreditCard, AlertCircle, Star, Shield, ArrowRight, Loader2, ChevronDown, ChevronUp, Building2, Users, Lock } from 'lucide-react'
import { PLANS, ENTERPRISE_PLAN } from '@/lib/plans'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface BillingInfo {
  planTier: string
  subscription?: {
    status: string
    stripeCurrentPeriodEnd?: string
    cancelAtPeriodEnd?: boolean
    billingInterval?: string
  }
  organization?: { stripeCustomerId?: string; name: string }
  campaignsThisMonth: number
  campaignLimit: number | string
  daysUntilReset: number
}

const FEATURE_COMPARISON = [
  { category: 'Content Generation', features: [
    { name: 'Campaigns per month', free: '3', starter: '5', pro: 'Unlimited', brokerage: 'Unlimited' },
    { name: 'Facebook posts (6 weeks)', free: true, starter: true, pro: true, brokerage: true },
    { name: 'Instagram captions (6 weeks)', free: true, starter: true, pro: true, brokerage: true },
    { name: 'Email copy (Just Listed + Still Available)', free: true, starter: true, pro: true, brokerage: true },
    { name: 'Print-ready flyer (PDF)', free: true, starter: true, pro: true, brokerage: true },
    { name: 'Video & Reel scripts', free: false, starter: false, pro: true, brokerage: true },
    { name: 'Flyer templates', free: '1', starter: '3', pro: '3 + 5 color schemes', brokerage: '3 + Custom' },
  ]},
  { category: 'Brand & Customization', features: [
    { name: 'Brand kit (logo, colors, photo)', free: false, starter: true, pro: true, brokerage: true },
    { name: 'Custom agent tagline & persona', free: false, starter: true, pro: true, brokerage: true },
    { name: 'Remove CampaignAI branding', free: false, starter: true, pro: true, brokerage: true },
    { name: 'White-label all outputs', free: false, starter: false, pro: false, brokerage: true },
    { name: 'Custom app name & logo', free: false, starter: false, pro: false, brokerage: true },
  ]},
  { category: 'Publishing & Distribution', features: [
    { name: 'Copy to clipboard', free: true, starter: true, pro: true, brokerage: true },
    { name: 'Auto-generated listing microsite', free: false, starter: true, pro: true, brokerage: true },
    { name: 'Direct social scheduling (coming soon)', free: false, starter: false, pro: true, brokerage: true },
    { name: 'Email platform integrations (coming soon)', free: false, starter: false, pro: true, brokerage: true },
  ]},
  { category: 'Team & Admin', features: [
    { name: 'Agent seats', free: '1', starter: '1', pro: '3', brokerage: '25' },
    { name: 'Analytics dashboard', free: false, starter: false, pro: false, brokerage: true },
    { name: 'Compliance & audit logs', free: false, starter: false, pro: false, brokerage: true },
    { name: 'Admin dashboard', free: false, starter: false, pro: false, brokerage: true },
    { name: 'CSV/PDF export', free: false, starter: false, pro: false, brokerage: true },
    { name: 'Priority support (Slack)', free: false, starter: false, pro: false, brokerage: true },
  ]},
  { category: 'Performance', features: [
    { name: 'Generation speed', free: 'Standard', starter: 'Standard', pro: 'Priority (<30s)', brokerage: 'Priority (<30s)' },
    { name: 'Campaign history', free: '7 days', starter: '30 days', pro: 'Unlimited', brokerage: 'Unlimited' },
  ]},
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-green-600 mx-auto" />
  if (value === false) return <X className="w-4 h-4 text-slate-300 mx-auto" />
  return <span className="text-xs text-center text-slate-700">{value}</span>
}

export default function BillingPage() {
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [showComparison, setShowComparison] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [canceledMsg, setCanceledMsg] = useState(false)

  useEffect(() => {
    // Check URL params for Stripe redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('success')) {
      setSuccessMsg(true)
      window.history.replaceState({}, '', '/dashboard/billing')
      toast.success('🎉 Subscription activated! Welcome to ' + (params.get('plan') || 'your new plan'))
    }
    if (params.get('canceled')) {
      setCanceledMsg(true)
      window.history.replaceState({}, '', '/dashboard/billing')
    }
    fetchBillingInfo()
  }, [])

  const fetchBillingInfo = async () => {
    try {
      const res = await fetch('/api/billing/info')
      if (res.ok) {
        const data = await res.json()
        setBillingInfo(data)
      }
    } catch (err) {
      console.error('Failed to load billing info:', err)
    } finally {
      setLoadingInfo(false)
    }
  }

  const handleUpgrade = async (planId: string) => {
    if (planId === billingInfo?.planTier) return

    const tiers = ['free', 'starter', 'pro', 'brokerage']
    const currentIdx = tiers.indexOf(billingInfo?.planTier ?? 'free')
    const targetIdx = tiers.indexOf(planId)
    const isDowngrade = targetIdx < currentIdx

    if (planId === 'free') {
      if (!billingInfo?.planTier || billingInfo.planTier === 'free') {
        toast('You are already on the free plan.', { icon: 'ℹ️' })
        return
      }
      // Go directly to Stripe cancel flow
      await handleCancelSubscription()
      return
    }

    if (isDowngrade) {
      await handleManageBilling()
      return
    }

    setLoading(planId)
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billing: annual ? 'annual' : 'monthly' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to create checkout')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleCancelSubscription = async () => {
    setLoading('cancel')
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow: 'cancel' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch (err: any) {
      toast.error(err.message || 'Could not open cancellation page.')
    } finally {
      setLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch (err: any) {
      toast.error(err.message || 'Could not open billing portal.')
    } finally {
      setLoading(null)
    }
  }

  const currentPlan = billingInfo?.planTier ?? 'free'

  const getPlanCTA = (planId: string) => {
    if (planId === currentPlan) return 'Current Plan'
    if (planId === 'free') return currentPlan !== 'free' ? 'Downgrade' : 'Current'
    const tierOrder = ['free', 'starter', 'pro', 'brokerage', 'enterprise']
    const currentIdx = tierOrder.indexOf(currentPlan)
    const planIdx = tierOrder.indexOf(planId)
    if (planIdx < currentIdx) return 'Downgrade'
    return planId === 'brokerage' ? 'Start 14-Day Trial' : 'Upgrade Now'
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">

      {/* Success/Cancel alerts */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-900">Your subscription is now active. Enjoy your new features!</p>
        </div>
      )}
      {canceledMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-900">Checkout was canceled. Your plan was not changed.</p>
        </div>
      )}

      {/* Current plan status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current Plan</div>
                <div className="font-display text-xl font-semibold text-slate-900 capitalize flex items-center gap-2">
                  {currentPlan}
                  {billingInfo?.subscription?.status && billingInfo.subscription.status !== 'active' && (
                    <span className="text-xs font-normal text-red-600 bg-red-50 px-2 py-0.5 rounded-full capitalize">
                      {billingInfo.subscription.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                {billingInfo?.campaignLimit === 'unlimited'
                  ? `${billingInfo.campaignsThisMonth ?? 0} campaigns this month`
                  : `${billingInfo?.campaignsThisMonth ?? 0} / ${billingInfo?.campaignLimit ?? 3} campaigns used`}
              </span>
              {(billingInfo?.daysUntilReset ?? 0) > 0 && (
                <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                  Resets in {billingInfo?.daysUntilReset} days
                </span>
              )}
              {billingInfo?.subscription?.stripeCurrentPeriodEnd && (
                <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                  {billingInfo.subscription.cancelAtPeriodEnd ? '⚠️ Cancels' : 'Renews'} {new Date(billingInfo.subscription.stripeCurrentPeriodEnd).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {currentPlan !== 'free' && (
            <button
              onClick={handleManageBilling}
              disabled={loading === 'portal'}
              className="flex items-center gap-2 text-sm font-medium border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex-shrink-0"
            >
              {loading === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {loading === 'portal' ? 'Opening...' : 'Manage Billing'}
            </button>
          )}
        </div>
      </div>

      {/* Billing toggle */}
      <div className="text-center">
        <div className="inline-flex items-center gap-3 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${annual ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Annual
            <span className="text-xs text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded-full">Save 28%</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const price = annual ? (plan.yearlyPrice ?? 0) : (plan.monthlyPrice ?? 0)
          const cta = getPlanCTA(plan.id)
          const isLoading = loading === plan.id

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 flex flex-col border-2 transition-all ${
                isCurrent && plan.highlighted
                  ? 'border-amber-400 bg-slate-900 shadow-xl ring-2 ring-amber-400 ring-offset-2'
                  : isCurrent
                  ? 'border-slate-900 bg-slate-900 shadow-lg'
                  : plan.highlighted
                  ? 'border-slate-900 bg-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {/* Badges */}
              <div className="flex items-center justify-between mb-3 h-6">
                {plan.badge && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${plan.highlighted ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                    {plan.badge}
                  </span>
                )}
                {isCurrent && <span className="text-xs font-semibold text-amber-300 bg-amber-400/20 border border-amber-400/40 px-2.5 py-1 rounded-full ml-auto">✓ Current Plan</span>}
              </div>

              <div className="font-display text-xl font-semibold mb-1 text-white">
                {plan.name}
              </div>
              <div className="text-xs mb-4 text-slate-400">{plan.tagline}</div>

              {/* Price */}
              <div className="mb-5">
                {plan.monthlyPrice === 0 ? (
                  <span className={`font-display text-3xl font-bold ${plan.highlighted || isCurrent ? 'text-white' : 'text-slate-900'}`}>Free</span>
                ) : (
                  <div>
                    <span className={`font-display text-3xl font-bold ${plan.highlighted || isCurrent ? 'text-white' : 'text-slate-900'}`}>
                      {formatCurrency(annual ? Math.round((plan.yearlyPrice ?? 0) / 12) : (plan.monthlyPrice ?? 0))}
                    </span>
                    <span className={`text-sm ml-1 ${plan.highlighted ? 'text-slate-400' : 'text-slate-400'}`}>/mo</span>
                    {annual && (plan.yearlyPrice ?? 0) > 0 && (
                      <div className="text-xs text-green-600 mt-0.5">{formatCurrency(plan.yearlyPrice ?? 0)}/year billed annually</div>
                    )}
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.filter(f => f.included).map((f) => (
                  <li key={f.text} className={`flex items-start gap-2 text-xs ${plan.highlighted || isCurrent ? 'text-slate-200' : 'text-slate-600'}`}>
                    <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${f.highlight ? 'text-amber-500' : plan.highlighted ? 'text-amber-400' : 'text-green-500'}`} />
                    <span className={f.highlight ? 'font-semibold' : ''}>{f.text}</span>
                  </li>
                ))}
                {plan.features.filter(f => !f.included).slice(0, 2).map((f) => (
                  <li key={f.text} className={`flex items-start gap-2 text-xs ${plan.highlighted || isCurrent ? 'text-slate-500' : 'text-slate-400'}`}>
                    <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-50" />
                    {f.text}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || isLoading}
                className={`w-full text-center text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-amber-100 text-amber-800 cursor-default'
                    : cta === 'Downgrade'
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                    : plan.highlighted
                    ? 'bg-amber-400 text-slate-900 hover:bg-amber-300'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 grain relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">Enterprise / MLS Board</span>
            </div>
            <h3 className="font-display text-2xl font-semibold text-white mb-2">{ENTERPRISE_PLAN.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{ENTERPRISE_PLAN.tagline}</p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {ENTERPRISE_PLAN.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-300">
                  <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-center gap-3 flex-shrink-0">
            <div className="text-white text-center">
              <div className="font-display text-2xl font-bold">Custom</div>
              <div className="text-slate-400 text-xs">Pricing per board/brokerage</div>
            </div>
            <a
              href="mailto:enterprise@campaignai.io?subject=Enterprise%20Inquiry"
              className="inline-flex items-center gap-2 bg-amber-400 text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-amber-300 transition-all text-sm"
            >
              Contact Sales
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* White-label callout */}
      <div className="bg-white rounded-xl border border-amber-200 p-5 flex gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 text-sm mb-1">White-Label Available on Brokerage & Enterprise</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Remove all CampaignAI branding from every output — flyers, emails, microsites. Use your own app name, logo, and support email.
            Agents at your brokerage will see your brand, not ours.
            Available starting at the <strong>Brokerage plan</strong> ($299/mo).
          </p>
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-slate-50 transition-colors"
        >
          <span className="font-display font-semibold text-slate-900">Full Feature Comparison</span>
          {showComparison ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showComparison && (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3 w-2/5">Feature</th>
                  {['Free', 'Starter', 'Pro', 'Brokerage'].map(p => (
                    <th key={p} className={`text-center text-xs font-semibold uppercase tracking-wide px-4 py-3 ${p.toLowerCase() === currentPlan ? 'text-amber-700' : 'text-slate-500'}`}>
                      {p}{p.toLowerCase() === currentPlan ? ' ✓' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_COMPARISON.map(cat => (
                  <>
                    <tr key={cat.category} className="bg-slate-50/50">
                      <td colSpan={5} className="px-6 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider">{cat.category}</td>
                    </tr>
                    {cat.features.map(feat => (
                      <tr key={feat.name} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-sm text-slate-700">{feat.name}</td>
                        <td className="px-4 py-3 text-center"><FeatureValue value={feat.free} /></td>
                        <td className="px-4 py-3 text-center"><FeatureValue value={feat.starter} /></td>
                        <td className="px-4 py-3 text-center"><FeatureValue value={feat.pro} /></td>
                        <td className="px-4 py-3 text-center"><FeatureValue value={feat.brokerage} /></td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
        {[
          { icon: Shield, text: 'SSL Encrypted Payments' },
          { icon: Lock, text: 'PCI-DSS Compliant' },
          { icon: Star, text: 'Cancel Anytime' },
          { icon: CreditCard, text: 'Powered by Stripe' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-1.5">
            <Icon className="w-4 h-4 text-slate-400" />
            {text}
          </div>
        ))}
      </div>
    </div>
  )
}
