-- Migration 0013: social post queue + digest preference.
-- Additive and idempotent. Run BEFORE deploying the new code.

BEGIN;

CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "source_key" text NOT NULL,
  "week" integer,
  "body" text NOT NULL,
  "scheduled_for" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'scheduled',
  "posted_at" timestamp,
  "reminder_sent_at" timestamp,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_posts_agent_sched_idx" ON "social_posts" ("agent_id", "scheduled_for");
CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_campaign_source_idx" ON "social_posts" ("campaign_id", "source_key");

CREATE TABLE IF NOT EXISTS "social_settings" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "digest" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

COMMIT;
