-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Duck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "appearance" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "accessoryId" TEXT,
    "accessoryColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Duck_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Duck" ("accessoryColor", "accessoryId", "appearance", "createdAt", "id", "memberId", "name", "origin", "updatedAt") SELECT "accessoryColor", "accessoryId", "appearance", "createdAt", "id", "memberId", "name", "origin", "updatedAt" FROM "Duck";
DROP TABLE "Duck";
ALTER TABLE "new_Duck" RENAME TO "Duck";
CREATE INDEX "Duck_memberId_createdAt_idx" ON "Duck"("memberId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
