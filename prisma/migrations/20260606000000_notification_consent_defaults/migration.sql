-- Change notifPush and notifEmail defaults from true → false
-- so new users are opted OUT of communications until they explicitly consent.
-- Existing rows are NOT affected — only future inserts without explicit values use this default.

ALTER TABLE "User" ALTER COLUMN "notifPush" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "notifEmail" SET DEFAULT false;
