-- AlterTable: destaque manual para o slider da home
ALTER TABLE "News" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: classificados
CREATE TABLE "Classified" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '📦',
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Classified_active_category_idx" ON "Classified"("active", "category");
