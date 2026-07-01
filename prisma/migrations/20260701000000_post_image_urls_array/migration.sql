-- Migration: replace single imageUrl with imageUrls array on Post table
-- Existing imageUrl values are migrated into the new array column before the old column is dropped.

-- Step 1: add the new array column
ALTER TABLE "Post" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT '{}';

-- Step 2: backfill — move any existing imageUrl value into the array
UPDATE "Post" SET "imageUrls" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL;

-- Step 3: drop the old column
ALTER TABLE "Post" DROP COLUMN "imageUrl";
