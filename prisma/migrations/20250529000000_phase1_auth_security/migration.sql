-- Phase 1: Auth security fields
-- These columns were applied via prisma db execute on 2025-05-29.
-- This migration records them in the migration history for tracking.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginCount"    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "passwordResetToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpiry"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "otpSentAt"            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "otpAttempts"          INTEGER     NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "User_passwordResetToken_idx"
  ON "User" ("passwordResetToken")
  WHERE "passwordResetToken" IS NOT NULL;
