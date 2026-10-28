-- Migration 0017: extra brand colors + server-side notification read state. Additive and idempotent.
-- Run in the Neon SQL editor BEFORE deploying.
BEGIN;

-- Named brand colors beyond primary + accent (Brand Kit page: "+ Add another color").
ALTER TABLE "brand_kits" ADD COLUMN IF NOT EXISTS "extra_colors" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- When the user last opened the notification bell. Anything created before this is "read" on every device.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifications_seen_at" timestamp;

COMMIT;
