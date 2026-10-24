-- Migration 0010: microsite lead capture (leads + per-agent lead settings).
-- Additive and idempotent. Run BEFORE deploying the new code.

BEGIN;

CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "listing_id" uuid REFERENCES "listings"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL DEFAULT 'new',
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "message" text,
  "preferred_date" text,
  "preferred_time" text,
  "source" text,
  "medium" text,
  "campaign_tag" text,
  "referrer_host" text,
  "consent_text" text NOT NULL,
  "consent_at" timestamp NOT NULL DEFAULT now(),
  "ip_hash" text,
  "delivery" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "leads_agent_created_idx" ON "leads" ("agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "leads_campaign_idx" ON "leads" ("campaign_id");
CREATE INDEX IF NOT EXISTS "leads_dedupe_idx" ON "leads" ("campaign_id", "email", "kind", "created_at");

CREATE TABLE IF NOT EXISTS "lead_settings" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "notify_email" text,
  "sms_enabled" boolean NOT NULL DEFAULT false,
  "sms_phone" text,
  "webhook_url" text,
  "webhook_secret" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

COMMIT;
