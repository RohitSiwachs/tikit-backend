/*
  Warnings:

  - Added the required column `updatedAt` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "badgeText" TEXT,
ADD COLUMN     "eventDateTime" TIMESTAMP(3),
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "body" DROP NOT NULL,
ALTER COLUMN "imageUrls" DROP DEFAULT;

-- Remove the default so Prisma @updatedAt manages it going forward
ALTER TABLE "Post" ALTER COLUMN "updatedAt" DROP DEFAULT;
