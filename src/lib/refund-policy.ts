/**
 * Single source of truth for the refund policy. Rendered on /refunds and in Terms §5, and summarised next to
 * every subscribe button (renewal notice), on the pricing footnote, and on the Billing page.
 * PRODUCT DECISION: the numbers below are the proposed defaults — change them here and every surface updates.
 */
export const REFUND_WINDOW_DAYS = 7          // first payment on a paid plan
export const REFUND_USAGE_CAP = 3            // campaigns generated in that window before the goodwill refund no longer applies
export const RENEWAL_GRACE_HOURS = 48        // accidental renewal
export const REFUND_EMAIL = 'support@listops.io'

export interface RefundClause { title: string; body: string }

export const REFUND_CLAUSES: RefundClause[] = [
  { title: `${REFUND_WINDOW_DAYS}-day first-purchase guarantee`, body: `If you are new to a paid plan and it is not right for you, email us within ${REFUND_WINDOW_DAYS} days of your first payment and we will refund that payment in full, as long as the account has generated ${REFUND_USAGE_CAP} or fewer campaigns in that time. This applies once per account.` },
  { title: 'Renewals', body: `Renewal payments are not refundable once the new period has started, so please cancel before your renewal date. If a renewal charges you by accident, contact us within ${RENEWAL_GRACE_HOURS} hours of the charge and, if you have not used the new period, we will refund it.` },
  { title: 'Free trials', body: 'If a plan includes a free trial (for example, 14 days on Brokerage), you are not charged if you cancel before the trial ends. Cancel anytime in Dashboard → Billing → Manage subscription.' },
  { title: 'Billing errors', body: 'If you were charged twice, charged the wrong amount, or charged after a cancellation that took effect, we will correct it and refund the difference in full.' },
  { title: 'Cancelling mid-period', body: 'You can cancel at any time. Your plan stays active until the end of the period you paid for, and we do not refund or pro-rate the unused part of a period (monthly or annual) outside the situations above.' },
  { title: 'Failed generations', body: 'If a campaign fails to generate, the generation is returned to your monthly allowance automatically; no payment is involved.' },
  { title: 'How to request a refund', body: `Email ${REFUND_EMAIL} from your account email address with the subject “Refund request”. Approved refunds are issued to the original payment method and typically appear within 5–10 business days, depending on your bank. When a refund is issued, the account returns to the Free plan.` },
]

/** One-line version for footnotes and disclosures. */
export const REFUND_SUMMARY = `${REFUND_WINDOW_DAYS}-day refund on your first payment; renewals and unused time are not refundable. Cancel anytime.`

/** Terms-of-Service paragraph form. */
export const REFUND_TERMS_TEXT = REFUND_CLAUSES.map(c => `${c.title}: ${c.body}`).join(' ')
