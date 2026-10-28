import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The ONE pill used for "Most Popular", "Best Value", "Commercial RE" and "Current Plan" so they always share
 * height, padding, radius and type. Only the colors differ by `tone`.
 */
export type PlanBadgeTone = 'highlight' | 'neutral' | 'current' | 'currentOnDark'

const TONES: Record<PlanBadgeTone, string> = {
  highlight: 'bg-amber-400 text-slate-900 border-amber-400',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  current: 'bg-green-50 text-green-700 border-green-200',
  currentOnDark: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
}

export function PlanBadge({ tone, className, children }: { tone: PlanBadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center h-6 px-2.5 rounded-full border text-xs font-semibold leading-none whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  )
}
