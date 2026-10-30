import { isAbsolute, resolve } from 'node:path';

/** Raíz del monorepo (este archivo vive en packages/db/src). */
export const REPO_ROOT = resolve(import.meta.dirname, '../../..');

export const DEFAULT_DATABASE_URL = 'file:./data/duckbot.db';

/**
 * Las rutas relativas de SQLite se resuelven desde la raíz del repo, no desde la carpeta en la que se ejecuta el
 * proceso: así el bot y el CLI de Prisma usan el mismo archivo.
 */
export function resolveDatabaseUrl(url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL): string {
  if (!url.startsWith('file:')) return url;
  const path = url.slice('file:'.length);
  return isAbsolute(path) ? url : `file:${resolve(REPO_ROOT, path)}`;
}

/** Carga el .env de la raíz, si existe. Las variables ya definidas no se pisan. */
export function loadRootEnv() {
  try {
    process.loadEnvFile(resolve(REPO_ROOT, '.env'));
  } catch {
    // Sin .env: se usan las variables del entorno.
  }
}
