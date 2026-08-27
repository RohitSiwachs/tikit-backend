-- Migration: Add individual invite code system + shared school code controls
-- Adds five control columns to School and creates the SchoolInviteCode table.
-- No existing columns are modified or removed.

-- ── 1. Extend School with shared-code control columns ──────────────────────

ALTER TABLE "School"
    ADD COLUMN "sharedCodeEnabled"          BOOLEAN   NOT NULL DEFAULT true,
    ADD COLUMN "sharedCodeExpiry"           TIMESTAMP(3),
    ADD COLUMN "sharedCodeMaxRedemptions"   INTEGER,
    ADD COLUMN "sharedCodeRedemptionCount"  INTEGER   NOT NULL DEFAULT 0,
    ADD COLUMN "sharedCodeApprovalRequired" BOOLEAN   NOT NULL DEFAULT false;

-- ── 2. Create SchoolInviteCode table ───────────────────────────────────────

CREATE TABLE "SchoolInviteCode" (
    "id"           TEXT         NOT NULL,
    "schoolId"     TEXT         NOT NULL,
    "code"         TEXT         NOT NULL,
    "studentName"  TEXT,
    "studentEmail" TEXT,
    "isUsed"       BOOLEAN      NOT NULL DEFAULT false,
    "usedByUserId" TEXT,
    "usedAt"       TIMESTAMP(3),
    "expiresAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolInviteCode_pkey" PRIMARY KEY ("id")
);

-- ── 3. Indexes ─────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "SchoolInviteCode_code_key"
    ON "SchoolInviteCode"("code");

CREATE INDEX "SchoolInviteCode_schoolId_idx"
    ON "SchoolInviteCode"("schoolId");

CREATE INDEX "SchoolInviteCode_isUsed_idx"
    ON "SchoolInviteCode"("isUsed");

-- ── 4. Foreign keys ────────────────────────────────────────────────────────

ALTER TABLE "SchoolInviteCode"
    ADD CONSTRAINT "SchoolInviteCode_schoolId_fkey"
    FOREIGN KEY ("schoolId")
    REFERENCES "School"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "SchoolInviteCode"
    ADD CONSTRAINT "SchoolInviteCode_usedByUserId_fkey"
    FOREIGN KEY ("usedByUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
