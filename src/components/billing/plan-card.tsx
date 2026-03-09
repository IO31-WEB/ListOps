'use client'

import { Check, Zap } from 'lucide-react'
import { useState } from 'react'
import { Plan } from '@/lib/stripe'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface BillingPlanCardProps {
  plan: Plan
  annual: boolean
  isCurrent: boolean
  isDowngrade?: boolean
}

export function BillingPlanCard({ plan, annual, isCurrent }: BillingPlanCardProps) {
  const [loading, setLoading] = useState(false)
  const price = annual ? (plan.yearlyPrice ?? 0) : (plan.monthlyPrice ?? 0)
  const priceId = annual ? plan.yearlyPriceId : plan.monthlyPriceId

  const handleUpgrade = async () => {
    if (!priceId) return
    setLoading(true)
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, interval: annual ? 'year' : 'month' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error('Could not start checkout')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn(
      'rounded-2xl p-5 border flex flex-col gap-4',
      plan.highlighted ? 'bg-slate-900 border-amber-400 border-2' : 'bg-white border-slate-200',
      isCurrent && 'border-green-300 border-2'
    )}>
      {plan.badge && (
        <span className={cn(
          'self-start text-xs font-bold px-2.5 py-1 rounded-full',
          plan.highlighted ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
        )}>
          {plan.badge}
        </span>
      )}

      <div>
        <h3 className={cn('font-display text-lg font-semibold', plan.highlighted ? 'text-white' : 'text-slate-900')}>
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1 mt-1">
          <span className={cn('font-display text-3xl font-bold', plan.highlighted ? 'text-white' : 'text-slate-900')}>
            {price === 0 ? 'Free' : `$${price}`}
          </span>
          {price > 0 && <span className={cn('text-sm', plan.highlighted ? 'text-slate-400' : 'text-slate-500')}>/mo</span>}
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {plan.features?.map((f) => (
          <li key={f.text} className="flex items-start gap-2 text-sm">
            <Check className={cn('w-4 h-4 mt-0.5 flex-shrink-0', plan.highlighted ? 'text-amber-400' : 'text-amber-500')} />
            <span className={plan.highlighted ? 'text-slate-300' : 'text-slate-600'}>{f.text}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="text-center text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl py-3">
          ✓ Current Plan
        </div>
      ) : (
        <button
          onClick={handleUpgrade}
          disabled={loading || !priceId}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50',
            plan.highlighted
              ? 'bg-amber-400 text-slate-900 hover:bg-amber-500'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          )}
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : <Zap className="w-4 h-4" />}
          {loading ? 'Loading...' : (plan.cta || 'Upgrade')}
        </button>
      )}
    </div>
  )
}
