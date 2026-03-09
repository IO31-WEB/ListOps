-- Migration: Convert referrals.status from plain text to enum
-- FIX: Enforces valid values at DB level, prevents data corruption from typos

-- Step 1: Create the enum type
CREATE TYPE "referral_status" AS ENUM('pending', 'signed_up', 'upgraded');

-- Step 2: Normalize any existing data before casting
UPDATE referrals SET status = 'pending'  WHERE status NOT IN ('pending', 'signed_up', 'upgraded');

-- Step 3: Cast the column to the new enum type
ALTER TABLE referrals
  ALTER COLUMN status TYPE referral_status
  USING status::referral_status;

-- Step 4: Restore the NOT NULL + default constraints
ALTER TABLE referrals
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending';
