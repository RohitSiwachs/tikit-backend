-- Step 1: Add 6 new columns to the User table.
-- Safe: ADD COLUMN IF NOT EXISTS with defaults — zero downtime, no data loss.
-- Existing rows get failedLoginCount=0, otpAttempts=0; all nullable cols stay NULL.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginCount"    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "passwordResetToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpiry"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "otpSentAt"            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "otpAttempts"          INTEGER     NOT NULL DEFAULT 0;
