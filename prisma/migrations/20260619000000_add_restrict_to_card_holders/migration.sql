-- Add restrictToCardHolders toggle to Event
-- When true, only students who hold one of the linkedCardIds can see/access the event.
ALTER TABLE "Event" ADD COLUMN "restrictToCardHolders" BOOLEAN NOT NULL DEFAULT false;
