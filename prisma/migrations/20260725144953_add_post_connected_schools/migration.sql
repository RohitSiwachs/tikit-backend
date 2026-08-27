-- CreateTable
CREATE TABLE "_PostConnectedSchools" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PostConnectedSchools_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PostConnectedSchools_B_index" ON "_PostConnectedSchools"("B");

-- AddForeignKey
ALTER TABLE "_PostConnectedSchools" ADD CONSTRAINT "_PostConnectedSchools_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostConnectedSchools" ADD CONSTRAINT "_PostConnectedSchools_B_fkey" FOREIGN KEY ("B") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
