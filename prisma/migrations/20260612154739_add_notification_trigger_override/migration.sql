-- CreateTable
CREATE TABLE "NotificationTriggerOverride" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "eventId" TEXT,
    "triggerKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTriggerOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTriggerOverride_schoolId_eventId_triggerKey_key" ON "NotificationTriggerOverride"("schoolId", "eventId", "triggerKey");

-- CreateIndex
CREATE INDEX "NotificationTriggerOverride_schoolId_idx" ON "NotificationTriggerOverride"("schoolId");

-- CreateIndex
CREATE INDEX "NotificationTriggerOverride_eventId_idx" ON "NotificationTriggerOverride"("eventId");

-- AddForeignKey
ALTER TABLE "NotificationTriggerOverride" ADD CONSTRAINT "NotificationTriggerOverride_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTriggerOverride" ADD CONSTRAINT "NotificationTriggerOverride_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
