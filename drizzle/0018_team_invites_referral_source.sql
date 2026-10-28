-- Migration 0018: team seat invites + referral source. Additive and idempotent. Run BEFORE deploying.
BEGIN;

CREATE TABLE IF NOT EXISTS "team_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "inviter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL DEFAULT 'agent',
  "token_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "accepted_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "accepted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_invite_token_idx" ON "team_invites" ("token_hash");
CREATE INDEX IF NOT EXISTS "team_invite_org_idx" ON "team_invites" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "team_invite_email_idx" ON "team_invites" ("email");
-- At most one live invite per (org, email).
CREATE UNIQUE INDEX IF NOT EXISTS "team_invite_one_pending_idx" ON "team_invites" ("org_id", "email") WHERE "status" = 'pending';

ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'link';
CREATE INDEX IF NOT EXISTS "referral_referrer_idx" ON "referrals" ("referrer_id");
CREATE INDEX IF NOT EXISTS "referral_referred_user_idx" ON "referrals" ("referred_user_id");

-- Historical rows written by the old invite flow were seat invites, not link referrals.
UPDATE "referrals" SET "source" = 'team' WHERE "status" = 'pending' AND "referred_user_id" IS NULL AND "source" = 'link';

-- Seat limits are now Free 1 / Starter 1 / Pro 2 / Commercial 2 / Brokerage 25 (Enterprise custom).
UPDATE "organizations" SET "max_agents" = CASE "plan"
  WHEN 'pro' THEN 2 WHEN 'commercial' THEN 2 WHEN 'brokerage' THEN 25 WHEN 'enterprise' THEN 999 ELSE 1 END;

COMMIT;