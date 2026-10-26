-- Migration 0012: listing performance tracking (daily event counters) + shareable seller reports.
-- Additive and idempotent. Run BEFORE deploying the new code.

BEGIN;

CREATE TABLE IF NOT EXISTS "campaign_events" (
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "day" text NOT NULL,
  "kind" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("campaign_id", "day", "kind")
);

CREATE TABLE IF NOT EXISTS "seller_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "note" text,
  "views" integer NOT NULL DEFAULT 0,
  "last_viewed_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "seller_reports_token_idx" ON "seller_reports" ("token");
CREATE INDEX IF NOT EXISTS "seller_reports_campaign_idx" ON "seller_reports" ("campaign_id");

COMMIT;
