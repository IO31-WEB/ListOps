-- Migration 0008: age gate / terms acceptance, email suppression list, upload tracking.
-- Additive and idempotent. Run BEFORE deploying the new code.

BEGIN;

-- 1. Legal gates on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "age_confirmed_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "age_blocked_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_version" text;

-- 2. Email suppression list (unsubscribes / bounces / complaints)
CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "email" text PRIMARY KEY,
  "reason" text NOT NULL DEFAULT 'unsubscribe',
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- 3. Uploaded listing photos (enables orphan cleanup)
CREATE TABLE IF NOT EXISTS "listing_uploads" (
  "key" text PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "bytes" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "listing_uploads_created_idx" ON "listing_uploads" ("created_at");
CREATE INDEX IF NOT EXISTS "listing_uploads_user_idx" ON "listing_uploads" ("user_id");

-- 4. Back-fill: photos already attached to listings are tracked so cleanup never touches them.
INSERT INTO "listing_uploads" ("key", "user_id", "bytes")
SELECT k, l."agent_id", 0
FROM "listings" l, LATERAL unnest(coalesce(l."photo_keys", '{}')) AS k
ON CONFLICT DO NOTHING;

-- 5. Dashboard speed: covering index for the campaign list (agent + newest first)
CREATE INDEX IF NOT EXISTS "campaign_agent_created_idx" ON "campaigns" ("agent_id", "created_at");

COMMIT;

-- EXISTING USERS: they have no age_confirmed_at, so on their next dashboard visit they are
-- shown the one-time "Confirm you are 18+" screen. To skip that for accounts you already
-- trust (e.g. paying customers), run once:
--   UPDATE "users" SET "age_confirmed_at" = now(), "terms_accepted_at" = now(), "terms_version" = 'grandfathered'
--   WHERE "id" IN (SELECT ... paying users ...);
