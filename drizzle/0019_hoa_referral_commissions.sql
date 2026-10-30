-- Migration 0019: optional HOA on listings + referral commission tracking + payout email. Additive and idempotent. Run BEFORE deploying.
BEGIN;

-- Item 8: optional HOA section ({ hasHoa: boolean, monthlyFee?: number, notes?: string }); NULL = agent did not answer.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "hoa" jsonb;

-- Item 11: referral payouts (manual payout, tracked per paid invoice).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_email" text;

CREATE TABLE IF NOT EXISTS "referral_commissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referral_id" uuid NOT NULL REFERENCES "referrals"("id") ON DELETE CASCADE,
  "referrer_id" uuid NOT NULL REFERENCES "users"("id"),
  "referred_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "stripe_invoice_id" text NOT NULL,
  "amount_paid_cents" integer NOT NULL,
  "commission_cents" integer NOT NULL,
  "rate_bps" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "eligible_at" timestamp NOT NULL,
  "paid_at" timestamp,
  "paid_method" text,
  "paid_reference" text,
  "paid_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now()
);
-- One commission per Stripe invoice: webhook retries can never double-accrue.
CREATE UNIQUE INDEX IF NOT EXISTS "referral_commission_invoice_idx" ON "referral_commissions" ("stripe_invoice_id");
CREATE INDEX IF NOT EXISTS "referral_commission_referrer_idx" ON "referral_commissions" ("referrer_id", "status");
CREATE INDEX IF NOT EXISTS "referral_commission_referral_idx" ON "referral_commissions" ("referral_id");

COMMIT;
