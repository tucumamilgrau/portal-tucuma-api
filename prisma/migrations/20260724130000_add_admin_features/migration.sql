-- AlterTable: moderação de comentários
ALTER TABLE "Comment" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Comment" ADD COLUMN "flagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Comment" ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: configuração do filtro heurístico
CREATE TABLE "ModerationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT NOT NULL DEFAULT 'cassino,aposta,empréstimo fácil,clique aqui,ganhe dinheiro,http://,https://,www.'
);

-- CreateTable: anúncios/publicidade
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Advertisement_slot_active_idx" ON "Advertisement"("slot", "active");
