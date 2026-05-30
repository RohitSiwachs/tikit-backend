-- Step 2: Sparse index on passwordResetToken.
-- Using regular CREATE INDEX (not CONCURRENTLY) — acceptable here because:
--   a) The column is new, all rows are NULL — index build is near-instant.
--   b) psql is not available for an out-of-transaction CONCURRENTLY run.
-- Lock duration: milliseconds on a small table.

CREATE INDEX IF NOT EXISTS "User_passwordResetToken_idx"
  ON "User" ("passwordResetToken")
  WHERE "passwordResetToken" IS NOT NULL;
