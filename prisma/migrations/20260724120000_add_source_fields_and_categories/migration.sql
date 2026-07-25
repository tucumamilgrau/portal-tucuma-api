-- AlterTable
ALTER TABLE "News" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "News" ADD COLUMN "sourceName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "News_sourceUrl_key" ON "News"("sourceUrl");
