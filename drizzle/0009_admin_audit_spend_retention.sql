-- Migration 0009: admin portal, AI spend ledger, failure reasons, refunds, soft delete, idempotency index.
-- Additive and idempotent. Run BEFORE deploying the new code.

BEGIN;

-- 1. Campaigns: why a generation failed + refund marker (a generation can only be refunded once)
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "failure_reason" text;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "refunded_at" timestamp;

-- 2. DOUBLE-SUBMIT PROTECTION at the database level: at most ONE in-flight generation per listing.
--    First, close out any rows stuck in 'generating' for >10 min so the index can be created.
UPDATE "campaigns" SET "status" = 'failed', "failure_reason" = COALESCE("failure_reason", 'Timed out')
  WHERE "status" = 'generating' AND "created_at" < now() - interval '10 minutes';
-- (If this still fails, two recent rows are generating for one listing: mark the older one failed and re-run.)
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_one_generating_per_listing"
  ON "campaigns" ("listing_id") WHERE "status" = 'generating' AND "listing_id" IS NOT NULL;

-- 3. Users: soft delete
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

-- 4. AI usage ledger (durable spend history; Redis only holds live counters)
CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "kind" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "cost_usd" numeric(10,4) NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_usage_created_idx" ON "ai_usage" ("created_at");
CREATE INDEX IF NOT EXISTS "ai_usage_clerk_idx" ON "ai_usage" ("clerk_id", "created_at");

-- 5. Audit log: make sure it exists (it is created by scripts/migrate.ts on fresh installs) + query indexes
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid REFERENCES "organizations"("id"),
  "user_id" uuid REFERENCES "users"("id"),
  "action" text NOT NULL,
  "resource_type" text,
  "resource_id" uuid,
  "metadata" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" ("resource_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action", "created_at");

-- 6. Stripe webhook idempotency (Stripe delivers events at-least-once; duplicates must not re-run side effects)
CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- 7. Scheduled outreach follow-ups (emails 2..N of a sequence)
CREATE TABLE IF NOT EXISTS "outreach_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "report_id" uuid NOT NULL,
  "batch_id" uuid NOT NULL,
  "recipient_email" text NOT NULL,
  "recipient_name" text,
  "step_index" integer NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "send_at" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "skip_reason" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "sent_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "outreach_due_idx" ON "outreach_emails" ("status", "send_at");
CREATE INDEX IF NOT EXISTS "outreach_user_report_idx" ON "outreach_emails" ("user_id", "report_id");
CREATE UNIQUE INDEX IF NOT EXISTS "outreach_batch_recipient_step_idx" ON "outreach_emails" ("batch_id", "recipient_email", "step_index");

COMMIT;
