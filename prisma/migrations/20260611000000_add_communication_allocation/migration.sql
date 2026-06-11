-- Migration: Add communication_allocation table
-- Tracks per-school push/email/SMS quota (allocated) and consumption (used).
-- One record per school (UNIQUE schoolId). Additive only — no existing tables altered.

CREATE TABLE "CommunicationAllocation" (
    "id"             TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "pushAllocated"  INTEGER NOT NULL DEFAULT 0,
    "pushUsed"       INTEGER NOT NULL DEFAULT 0,
    "emailAllocated" INTEGER NOT NULL DEFAULT 0,
    "emailUsed"      INTEGER NOT NULL DEFAULT 0,
    "smsAllocated"   INTEGER NOT NULL DEFAULT 0,
    "smsUsed"        INTEGER NOT NULL DEFAULT 0,
    "pushPrice"      DECIMAL(10,4),
    "emailPrice"     DECIMAL(10,4),
    "smsPrice"       DECIMAL(10,4),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationAllocation_pkey" PRIMARY KEY ("id")
);

-- One allocation record per school
CREATE UNIQUE INDEX "CommunicationAllocation_schoolId_key"
    ON "CommunicationAllocation"("schoolId");

-- Foreign key to School — cascade delete so removing a school cleans up its allocation
ALTER TABLE "CommunicationAllocation"
    ADD CONSTRAINT "CommunicationAllocation_schoolId_fkey"
    FOREIGN KEY ("schoolId")
    REFERENCES "School"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
