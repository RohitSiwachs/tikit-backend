-- Backfill: insert a default CommunicationAllocation (500 per channel) for every
-- school that does not already have one.
-- Safe to re-run — the WHERE NOT EXISTS guard prevents duplicate inserts.

INSERT INTO "CommunicationAllocation" (
    "id",
    "schoolId",
    "pushAllocated",  "pushUsed",
    "emailAllocated", "emailUsed",
    "smsAllocated",   "smsUsed",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    s."id",
    500, 0,
    500, 0,
    500, 0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "School" s
WHERE NOT EXISTS (
    SELECT 1
    FROM   "CommunicationAllocation" ca
    WHERE  ca."schoolId" = s."id"
);
