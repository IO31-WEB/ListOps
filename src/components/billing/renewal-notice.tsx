import Link from 'next/link'

interface Props {
  planName: string
  /** price actually charged each period, in whole dollars */
  price: number
  interval: 'month' | 'year'
  trialDays?: number
  dark?: boolean
  className?: string
}

/**
 * Auto-renewal disclosure. Render this DIRECTLY next to (under) every subscribe / upgrade button —
 * clear and conspicuous, before the customer pays (FTC ROSCA, California ARL and similar state laws).
 * Keep the wording in sync with the Terms (§3 Account & Billing) and the Stripe Checkout message
 * in api/billing/create-checkout.
 */
export function renewalSummary({ planName, price, interval, trialDays }: Omit<Props, 'dark' | 'className'>): string {
  const per = interval === 'year' ? 'year' : 'month'
  const money = `$${price.toLocaleString('en-US')}`
  const start = trialDays
    ? `Free for ${trialDays} days, then ${money}/${per}. Your card is charged automatically when the trial ends. `
    : `${money}/${per}, charged today. `
  return (
    `${planName}: ${start}Renews automatically every ${per} at ${money} until you cancel. ` +
    `Cancel anytime in Dashboard → Billing → Manage subscription; your plan stays active until the end of the period you paid for (no refunds for partial periods, except as in our refund policy). Taxes may apply.`
  )
}

export function RenewalNotice({ planName, price, interval, trialDays, dark, className = '' }: Props) {
  const per = interval === 'year' ? 'year' : 'month'
  const money = `$${price.toLocaleString('en-US')}`
  const tone = dark ? 'text-slate-300' : 'text-slate-500'
  const strong = dark ? 'text-white' : 'text-slate-700'
  return (
    <p className={`text-[11px] leading-snug ${tone} ${className}`}>
      <span className={`font-semibold ${strong}`}>
        {trialDays ? `Free for ${trialDays} days, then ${money}/${per}.` : `${money}/${per}.`}
      </span>{' '}
      {trialDays ? 'Your card is charged automatically when the trial ends. ' : ''}
      Renews automatically every {per} until you cancel. Cancel anytime in Billing → Manage subscription; access continues to the end of the paid period. Taxes may apply.{' '}
      <Link href="/refunds" className="underline">Refund policy</Link>{' · '}<Link href="/terms#billing" className="underline">Terms</Link>
    </p>
  )
}
