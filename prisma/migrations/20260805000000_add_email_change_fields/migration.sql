-- Add email change flow fields to User table
-- Step 1: OTP sent to current email → changeToken issued
-- Step 2: OTP sent to new email → email updated on verify

ALTER TABLE "User"
  ADD COLUMN "emailChangeToken"      TEXT,
  ADD COLUMN "emailChangeExpiry"     TIMESTAMP(3),
  ADD COLUMN "emailChangePending"    TEXT,
  ADD COLUMN "emailChangeOtp"        TEXT,
  ADD COLUMN "emailChangeOtpExpiry"  TIMESTAMP(3),
  ADD COLUMN "emailChangeOtpSentAt"  TIMESTAMP(3),
  ADD COLUMN "emailChangeOtpAttempts" INTEGER NOT NULL DEFAULT 0;
