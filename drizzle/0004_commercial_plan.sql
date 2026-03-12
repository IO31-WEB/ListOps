-- Migration: Add commercial plan tier + CoStar report tables
-- Adds the $179/mo "Commercial" plan with CoStar data integration and property grading

-- ── Step 1: Extend the tier enum ───────────────────────────────
-- Postgres requires creating a new enum and swapping — cannot ALTER ENUM in-place on all versions
ALTER TYPE "tier" ADD VALUE IF NOT EXISTS 'commercial';

-- ── Step 2: CoStar report upload source enum ──────────────────
DO $$ BEGIN
  CREATE TYPE "costar_source" AS ENUM('manual_upload', 'api_push', 'email_forward');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 3: Property grade letter enum ────────────────────────
DO $$ BEGIN
  CREATE TYPE "property_grade" AS ENUM('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 4: costar_reports table ──────────────────────────────
CREATE TABLE IF NOT EXISTS "costar_reports" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"               UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id"              UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  -- Property identity
  "property_address"     TEXT NOT NULL,
  "property_city"        TEXT,
  "property_state"       TEXT,
  "property_zip"         TEXT,
  "property_lat"         NUMERIC(10, 7),
  "property_lng"         NUMERIC(10, 7),

  -- Source tracking
  "source"               costar_source NOT NULL DEFAULT 'manual_upload',
  "raw_pdf_url"          TEXT,           -- R2 key for the original PDF
  "raw_pdf_filename"     TEXT,

  -- Parsed CoStar data (structured from PDF or API)
  "consumer_spend"       JSONB,          -- { oneMile, threeMile, fiveMile: { total, apparel, food, ... } }
  "demographics"         JSONB,          -- { oneMile, threeMile, fiveMile: { population, medianAge, medianIncome, ... } }
  "traffic_counts"       JSONB,          -- [{ street, avgDailyVolume, year, distance }]
  "housing_data"         JSONB,          -- { medianHomeValue, ownerOccupied, renterOccupied, ... }
  "nearby_retailers"     JSONB,          -- [{ name, distance, salesVolume, grade, category }]

  -- Parse metadata
  "parse_model"          TEXT,           -- 'claude-sonnet-4-20250514' or 'costar_api_v1'
  "parse_tokens_used"    INTEGER,
  "parse_completed_at"   TIMESTAMP,
  "parse_error"          TEXT,           -- null = success

  "created_at"           TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "costar_org_id_idx"  ON "costar_reports"("org_id");
CREATE INDEX IF NOT EXISTS "costar_user_id_idx" ON "costar_reports"("user_id");

-- ── Step 5: property_grades table ─────────────────────────────
CREATE TABLE IF NOT EXISTS "property_grades" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"               UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id"              UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "costar_report_id"     UUID NOT NULL REFERENCES "costar_reports"("id") ON DELETE CASCADE,

  -- Overall grade
  "overall_grade"        property_grade NOT NULL,
  "overall_score"        NUMERIC(5, 2) NOT NULL,  -- 0–100

  -- Category scores (0–100 each)
  "traffic_score"        NUMERIC(5, 2) NOT NULL,
  "traffic_grade"        property_grade NOT NULL,

  "consumer_spend_score" NUMERIC(5, 2) NOT NULL,
  "consumer_spend_grade" property_grade NOT NULL,

  "household_income_score" NUMERIC(5, 2) NOT NULL,
  "household_income_grade" property_grade NOT NULL,

  "demographics_score"   NUMERIC(5, 2) NOT NULL,
  "demographics_grade"   property_grade NOT NULL,

  "anchor_tenant_score"  NUMERIC(5, 2) NOT NULL,
  "anchor_tenant_grade"  property_grade NOT NULL,

  -- Detected anchor tenants / big-box names
  "anchor_tenants"       JSONB,   -- [{ name, distance, category, salesGrade }]

  -- AI narrative summary
  "ai_summary"           TEXT,
  "ai_strengths"         JSONB,   -- string[]
  "ai_risks"             JSONB,   -- string[]
  "ai_recommendation"    TEXT,

  -- Grade weights used (snapshot so historical grades stay accurate if weights change)
  "weights_snapshot"     JSONB NOT NULL,

  "generated_at"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at"           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "grade_org_id_idx"         ON "property_grades"("org_id");
CREATE INDEX IF NOT EXISTS "grade_costar_report_idx"  ON "property_grades"("costar_report_id");

-- ── Step 6: grade_weights config (per-org overrides) ──────────
CREATE TABLE IF NOT EXISTS "grade_weights" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"      UUID UNIQUE NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "traffic"              NUMERIC(4, 2) NOT NULL DEFAULT 0.25,
  "consumer_spend"       NUMERIC(4, 2) NOT NULL DEFAULT 0.25,
  "household_income"     NUMERIC(4, 2) NOT NULL DEFAULT 0.20,
  "demographics"         NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
  "anchor_tenant"        NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
  "updated_at"  TIMESTAMP NOT NULL DEFAULT NOW()
);
