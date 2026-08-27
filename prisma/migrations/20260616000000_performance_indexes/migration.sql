-- Performance index migration — additive only, safe to apply on live DB.
-- These composite indexes eliminate sequential scans on the hottest query paths:
--   • Wallet:  WHERE userId + status filter
--   • Scanner: WHERE eventId + status counts
--   • Feed:    WHERE deletedAt IS NULL ORDER BY createdAt DESC
--   • Events:  WHERE isPublished + ORDER BY startsAt (with and without schoolId)

-- ── Ticket: wallet query ────────────────────────────────────────────────────
-- getWallet loads all tickets for a user. A composite (userId, status) index
-- lets Postgres satisfy `WHERE userId = ? AND status != 'VOID'` with a single
-- index scan instead of a heap scan filtered in memory.
CREATE INDEX IF NOT EXISTS "Ticket_userId_status_idx"
    ON "Ticket"("userId", "status");

-- ── Ticket: scanner event stats ─────────────────────────────────────────────
-- getEventStats runs two COUNT queries: one for non-void, one for CHECKED_IN.
-- A composite (eventId, status) index covers both with index-only scans.
CREATE INDEX IF NOT EXISTS "Ticket_eventId_status_idx"
    ON "Ticket"("eventId", "status");

-- ── Post: feed query ────────────────────────────────────────────────────────
-- getFeed: WHERE deletedAt IS NULL ORDER BY createdAt DESC.
-- The composite index lets Postgres use the index for both the filter and the
-- sort, avoiding a full-table sort on large post tables.
CREATE INDEX IF NOT EXISTS "Post_deletedAt_createdAt_idx"
    ON "Post"("deletedAt", "createdAt" DESC);

-- ── Event: published listing ────────────────────────────────────────────────
-- findAll: WHERE isPublished = true ORDER BY startsAt ASC.
-- Single-column indexes on isPublished and startsAt exist but Postgres must
-- merge two bitmap scans. A composite eliminates the merge step.
CREATE INDEX IF NOT EXISTS "Event_isPublished_startsAt_idx"
    ON "Event"("isPublished", "startsAt");

-- ── Event: school-scoped published listing ──────────────────────────────────
-- findAll with schoolId filter: WHERE schoolId = ? AND isPublished = ? ORDER BY startsAt.
-- Covers the admin dashboard and student app's school feed in one index scan.
CREATE INDEX IF NOT EXISTS "Event_schoolId_isPublished_startsAt_idx"
    ON "Event"("schoolId", "isPublished", "startsAt");
