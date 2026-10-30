import { resolve } from 'node:path';

/** Raíz del monorepo (este archivo vive en apps/bot/src). */
export const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/** La carpeta del arte (ASSETS_DIR): una ruta relativa parte de la raíz del repo; una absoluta se usa tal cual. */
export const assetsDir = (configured: string) => resolve(REPO_ROOT, configured);
