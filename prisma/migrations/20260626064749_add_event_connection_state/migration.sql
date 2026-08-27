-- DropIndex
DROP INDEX "Post_deletedAt_createdAt_idx";

-- AlterTable
ALTER TABLE "TicketType" ADD COLUMN     "connectionStateId" TEXT;

-- CreateTable
CREATE TABLE "EventConnectionState" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventConnectionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventConnectionState_eventId_idx" ON "EventConnectionState"("eventId");

-- CreateIndex
CREATE INDEX "EventConnectionState_schoolId_idx" ON "EventConnectionState"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "EventConnectionState_eventId_schoolId_key" ON "EventConnectionState"("eventId", "schoolId");

-- CreateIndex
CREATE INDEX "Post_deletedAt_createdAt_idx" ON "Post"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "TicketType_connectionStateId_idx" ON "TicketType"("connectionStateId");

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_connectionStateId_fkey" FOREIGN KEY ("connectionStateId") REFERENCES "EventConnectionState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventConnectionState" ADD CONSTRAINT "EventConnectionState_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventConnectionState" ADD CONSTRAINT "EventConnectionState_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
