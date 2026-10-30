-- AlterTable
ALTER TABLE "Duck" ADD COLUMN "accessoryColor" TEXT;
ALTER TABLE "Duck" ADD COLUMN "accessoryId" TEXT;

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "multiplier" REAL NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "XpEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "guildId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "price" INTEGER,
    "roleId" TEXT,

    PRIMARY KEY ("guildId", "accessoryId"),
    CONSTRAINT "ShopItem_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "Race_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RaceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "duckId" TEXT NOT NULL,
    "lane" INTEGER NOT NULL,
    "level" INTEGER,
    "position" INTEGER,
    "prize" INTEGER,
    CONSTRAINT "RaceEntry_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RaceEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RaceEntry_duckId_fkey" FOREIGN KEY ("duckId") REFERENCES "Duck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Guild" ("createdAt", "id") SELECT "createdAt", "id" FROM "Guild";
DROP TABLE "Guild";
ALTER TABLE "new_Guild" RENAME TO "Guild";
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "lastXpAt" DATETIME,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("createdAt", "discordId", "guildId", "id") SELECT "createdAt", "discordId", "guildId", "id" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_discordId_guildId_key" ON "Member"("discordId", "guildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "XpEvent_guildId_endsAt_idx" ON "XpEvent"("guildId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_memberId_accessoryId_key" ON "InventoryItem"("memberId", "accessoryId");

-- CreateIndex
CREATE INDEX "CoinTransaction_memberId_createdAt_idx" ON "CoinTransaction"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "Race_guildId_dayKey_idx" ON "Race"("guildId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "RaceEntry_raceId_memberId_key" ON "RaceEntry"("raceId", "memberId");
