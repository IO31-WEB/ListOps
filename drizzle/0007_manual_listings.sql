-- Migration 0007: Remove the MLS dependency from listings.
--
-- Safe to run on a live database: additive columns + relaxed constraints only.
-- Existing rows are kept and tagged source='mls_legacy' so nothing is lost.
-- Idempotent (IF [NOT] EXISTS) — safe to re-run.

BEGIN;

-- 1. MLS identity is no longer required
ALTER TABLE "listings" ALTER COLUMN "mls_id" DROP NOT NULL;
ALTER TABLE "listings" ALTER COLUMN "mls_board" DROP NOT NULL;
ALTER TABLE "listings" ALTER COLUMN "mls_board" DROP DEFAULT;
DROP INDEX IF EXISTS "listing_mls_id_board_idx";

-- 2. New columns for manual / enriched listings
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual';
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "enrichment_provider" text;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "enrichment_data" jsonb;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "photo_keys" text[] DEFAULT '{}';
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

-- 3. Tag everything that came from an MLS feed BEFORE this migration.
--    (mls_id is only ever set on legacy rows; manual rows created before this
--     migration used a 'manual:' prefix — tag those as manual instead.)
UPDATE "listings" SET "source" = 'mls_legacy'
  WHERE "mls_id" IS NOT NULL AND "mls_id" NOT LIKE 'manual:%' AND "source" = 'manual';
UPDATE "listings" SET "mls_id" = NULL, "mls_board" = NULL
  WHERE "mls_id" LIKE 'manual:%';

-- 4. Per-user listing lookups
CREATE INDEX IF NOT EXISTS "listing_agent_created_idx" ON "listings" ("agent_id", "created_at");

COMMIT;

-- OPTIONAL (decide with your counsel): MLS-sourced raw payloads and photos may be
-- subject to the MLS/Repliers license terms. If you no longer hold that license,
-- purge licensed content from legacy rows after the retention period you choose:
--   UPDATE "listings" SET "raw_data" = NULL, "photos" = '{}'
--     WHERE "source" = 'mls_legacy';
