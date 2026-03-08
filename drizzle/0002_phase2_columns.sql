-- Phase 2 migrations
-- Run in Neon SQL editor or via: npx drizzle-kit push

-- Add PDF URL to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pdf_url text;

-- Add feature flags to organizations  
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT '{}';

-- Index for faster referral lookups
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_email_idx ON referrals(referred_email);
