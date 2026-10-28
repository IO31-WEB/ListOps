-- Migration 0014: trackable QR codes + per-day scan counters. Additive and idempotent. Run BEFORE deploying.
BEGIN;

CREATE TABLE IF NOT EXISTS "qr_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "placement" text NOT NULL,
  "code" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "qr_codes_code_idx" ON "qr_codes" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "qr_codes_campaign_placement_idx" ON "qr_codes" ("campaign_id", "placement");

CREATE TABLE IF NOT EXISTS "qr_scans" (
  "qr_id" uuid NOT NULL REFERENCES "qr_codes"("id") ON DELETE CASCADE,
  "day" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("qr_id", "day")
);

COMMIT;
