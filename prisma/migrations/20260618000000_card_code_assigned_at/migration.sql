-- Add assignedAt to CardCode to track when an admin reserved a batch code for a user
-- This is distinct from usedAt (when the student actually activates/claims the code)
ALTER TABLE "CardCode" ADD COLUMN "assignedAt" TIMESTAMP(3);

-- Compound indexes for efficient batch-assign queries
CREATE INDEX IF NOT EXISTS "CardCode_cardId_userId_idx" ON "CardCode"("cardId", "userId");
CREATE INDEX IF NOT EXISTS "CardCode_cardId_isUsed_idx" ON "CardCode"("cardId", "isUsed");
