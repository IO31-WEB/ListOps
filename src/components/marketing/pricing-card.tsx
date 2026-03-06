'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Plan } from '@/lib/stripe'

interface PricingCardProps {
  plan: Plan
  annual: boolean
  highlighted?: boolean
}

export function PricingCard({ plan, annual, highlighted }: PricingCardProps) {
  const price = annual ? plan.yearlyPrice : plan.monthlyPrice

  return (
    <div className={cn(
      'relative rounded-2xl p-6 flex flex-col',
      highlighted
        ? 'bg-slate-900 text-white ring-2 ring-amber-400'
        : 'bg-white border border-slate-200'
    )}>
      {plan.badge && (
        <div className={cn(
          'absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full',
          highlighted ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
        )}>
          {plan.badge}
        </div>
      )}

      <div className="mb-4">
        <h3 className={cn('font-display text-xl font-semibold mb-1', highlighted ? 'text-white' : 'text-slate-900')}>
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1">
          <span className={cn('font-display text-4xl font-bold', highlighted ? 'text-white' : 'text-slate-900')}>
            {price === 0 ? 'Free' : `$${price}`}
          </span>
          {price > 0 && (
            <span className={cn('text-sm', highlighted ? 'text-slate-400' : 'text-slate-500')}>/mo</span>
          )}
        </div>
        {annual && price > 0 && (
          <p className="text-xs text-amber-400 mt-0.5">Billed as ${Math.round(price * 12)}/yr</p>
        )}
      </div>

      <ul className="flex-1 space-y-2.5 mb-6">
        {plan.features?.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2.5 text-sm">
            <Check className={cn('w-4 h-4 mt-0.5 flex-shrink-0', highlighted ? 'text-amber-400' : 'text-amber-500')} />
            <span className={highlighted ? 'text-slate-300' : 'text-slate-600'}>{feature.text}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/sign-up"
        className={cn(
          'w-full text-center py-3 rounded-xl font-semibold text-sm transition-all',
          highlighted
            ? 'bg-amber-400 text-slate-900 hover:bg-amber-500'
            : 'bg-slate-900 text-white hover:bg-slate-800'
        )}
      >
        {plan.cta || 'Get Started'}
      </Link>
    </div>
  )
}
