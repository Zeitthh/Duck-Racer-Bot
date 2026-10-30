-- DropIndex
DROP INDEX "Duck_memberId_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RaceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "duckId" TEXT,
    "lane" INTEGER NOT NULL,
    "level" INTEGER,
    "position" INTEGER,
    "prize" INTEGER,
    CONSTRAINT "RaceEntry_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RaceEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RaceEntry_duckId_fkey" FOREIGN KEY ("duckId") REFERENCES "Duck" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RaceEntry" ("duckId", "id", "lane", "level", "memberId", "position", "prize", "raceId") SELECT "duckId", "id", "lane", "level", "memberId", "position", "prize", "raceId" FROM "RaceEntry";
DROP TABLE "RaceEntry";
ALTER TABLE "new_RaceEntry" RENAME TO "RaceEntry";
CREATE UNIQUE INDEX "RaceEntry_raceId_memberId_key" ON "RaceEntry"("raceId", "memberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Duck_memberId_createdAt_idx" ON "Duck"("memberId", "createdAt");
