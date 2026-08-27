-- Phase 1 — Auth Security Fields
-- Safe to run on live Supabase: all ADD COLUMN operations with defaults or nullability.
-- Run this SQL in Supabase SQL Editor BEFORE deploying the Phase 1 code.
--
-- Rollback: DROP COLUMN for each added column (data loss is minimal — fields were never set).
-- Estimated execution time: < 1 second.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginCount"    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "passwordResetToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpiry"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "otpSentAt"            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "otpAttempts"          INTEGER     NOT NULL DEFAULT 0;

-- Index for password reset lookups (sparse — only set on active reset requests)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_passwordResetToken_idx"
  ON "User" ("passwordResetToken")
  WHERE "passwordResetToken" IS NOT NULL;

-- Inventory repair: recalculate quantityRemaining for all TicketTypes.
-- This corrects any historical drift caused by voidTicket not restoring capacity.
-- Review the SELECT output first. If all deltas are 0, no repair is needed.
--
-- Step 1 — preview affected rows:
-- SELECT tt.id, tt."quantityTotal", tt."quantityRemaining",
--   tt."quantityTotal" - COALESCE(sub.active_count, 0) AS correct_remaining,
--   tt."quantityRemaining" - (tt."quantityTotal" - COALESCE(sub.active_count, 0)) AS drift
-- FROM "TicketType" tt
-- LEFT JOIN (
--   SELECT "ticketTypeId", COUNT(*) AS active_count
--   FROM "Ticket" WHERE status != 'VOID'
--   GROUP BY "ticketTypeId"
-- ) sub ON tt.id = sub."ticketTypeId"
-- WHERE tt."quantityRemaining" != (tt."quantityTotal" - COALESCE(sub.active_count, 0));
--
-- Step 2 — apply repair (uncomment when ready):
-- BEGIN;
-- UPDATE "TicketType" tt
-- SET
--   "quantityRemaining" = tt."quantityTotal" - COALESCE(sub.active_count, 0),
--   "isSoldOut" = (tt."quantityTotal" - COALESCE(sub.active_count, 0) = 0)
-- FROM (
--   SELECT "ticketTypeId", COUNT(*) AS active_count
--   FROM "Ticket" WHERE status != 'VOID'
--   GROUP BY "ticketTypeId"
-- ) sub
-- WHERE tt.id = sub."ticketTypeId";
-- COMMIT;
