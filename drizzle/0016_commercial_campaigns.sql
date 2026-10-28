-- Migration 0016: Commercial = a campaign type (v13). Additive and idempotent; existing rows stay residential.
-- Run BEFORE deploying. The old commercial tables (site_reports, property_grades, grade_weights, ...) are intentionally
-- left untouched (no data is dropped); nothing in the app reads them any more except the account-retention purge.
BEGIN;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "campaign_type" text NOT NULL DEFAULT 'residential';
ALTER TABLE "listings"  ADD COLUMN IF NOT EXISTS "commercial" jsonb;

CREATE INDEX IF NOT EXISTS "campaign_agent_type_idx" ON "campaigns" ("agent_id", "campaign_type");

COMMIT;
