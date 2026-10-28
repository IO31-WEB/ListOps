-- Migration 0011: brokerage compliance profile (required disclaimer, locked brand fields).
-- Additive and idempotent. Run BEFORE deploying the new code.

BEGIN;

CREATE TABLE IF NOT EXISTS "org_compliance" (
  "org_id" uuid PRIMARY KEY REFERENCES "organizations"("id") ON DELETE CASCADE,
  "required_disclaimer" text,
  "brokerage_license" text,
  "equal_housing" boolean NOT NULL DEFAULT false,
  "show_agent_license" boolean NOT NULL DEFAULT false,
  "locked" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" uuid,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

COMMIT;
