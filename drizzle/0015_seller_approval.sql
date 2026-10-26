-- Migration 0015: Seller Approval Portal. Additive and idempotent. Run BEFORE deploying.
BEGIN;

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "seller_name" text,
  "note" text,
  "items" jsonb NOT NULL,
  "views" integer NOT NULL DEFAULT 0,
  "last_viewed_at" timestamp,
  "submitted_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "approval_requests_token_idx" ON "approval_requests" ("token");
CREATE INDEX IF NOT EXISTS "approval_requests_campaign_idx" ON "approval_requests" ("campaign_id");

CREATE TABLE IF NOT EXISTS "approval_responses" (
  "request_id" uuid NOT NULL REFERENCES "approval_requests"("id") ON DELETE CASCADE,
  "item_key" text NOT NULL,
  "decision" text NOT NULL,
  "comment" text,
  "signed_name" text NOT NULL,
  "decided_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("request_id", "item_key")
);

COMMIT;
