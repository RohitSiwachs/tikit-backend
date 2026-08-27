-- AlterTable: Add freeForHostSchool toggle to TicketType
-- Additive only, no destructive changes, existing rows default to false
ALTER TABLE "TicketType" ADD COLUMN "freeForHostSchool" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: Set freeForHostSchool=true for existing free ticket types (price=0)
-- so they continue to be claimable after the eligibility logic changes
UPDATE "TicketType" SET "freeForHostSchool" = true WHERE price = 0;
