-- Migration 0006: Switch MLS data provider from SimplyRETS to Repliers
--
-- Changes the default value of listings.mls_board from 'simplyrets' to
-- 'repliers' for all new rows going forward.
--
-- Intentionally NOT backfilled: existing rows tagged 'simplyrets' really
-- were sourced from SimplyRETS at the time they were fetched, and rewriting
-- that history would make the column inaccurate for past listings. Only new
-- listings (fetched after this deploy) will be tagged 'repliers'.
--
-- Safety: single ALTER COLUMN, metadata-only, no table lock beyond the
-- default change itself, no rows touched.

BEGIN;

ALTER TABLE "listings"
  ALTER COLUMN "mls_board" SET DEFAULT 'repliers';

COMMIT;
