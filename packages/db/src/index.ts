import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';
import { resolveDatabaseUrl } from './url';

export type {
  CoinTransaction,
  Duck,
  Guild,
  InventoryItem,
  Member,
  Race,
  RaceEntry,
  ShopItem,
  XpEvent,
} from './generated/prisma/client';
export { PrismaClient } from './generated/prisma/client';
export { loadRootEnv, resolveDatabaseUrl } from './url';

/** Cliente de Prisma con el adaptador de SQLite. Crea la carpeta del archivo si no existe. */
export function createPrismaClient(url = resolveDatabaseUrl()): PrismaClient {
  if (url.startsWith('file:')) mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

/** ¿El error es de una restricción única (p. ej. el miembro ya tiene pato)? */
export const isUniqueViolation = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
