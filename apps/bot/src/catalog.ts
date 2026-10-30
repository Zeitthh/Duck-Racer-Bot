import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAccessories, parseCatalogFile, setAccessories, type CatalogEntry } from '@duckbot/core';
import type { Logger } from './logger';

export interface Catalog {
  entries: CatalogEntry[];
  get(id: string): CatalogEntry | undefined;
  /** Patos cuyo nombre contiene el texto (sin distinguir mayúsculas ni acentos). */
  search(query: string, limit?: number): CatalogEntry[];
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function createCatalog(entries: CatalogEntry[]): Catalog {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return {
    entries,
    get: (id) => byId.get(id),
    search(query, limit = 25) {
      const q = fold(query.trim());
      return entries.filter((e) => fold(e.name).includes(q)).slice(0, limit);
    },
  };
}

/**
 * Carga los cosméticos de `accessories.json`. Si el archivo no existe o no es válido, el bot arranca igual pero sin
 * cosméticos (la tienda queda vacía) y lo avisa en el log. Devuelve cuántos cargó.
 */
export function loadAccessories(file: string, logger: Logger): number {
  try {
    const list = parseAccessories(JSON.parse(readFileSync(file, 'utf8')));
    setAccessories(list);
    return list.length;
  } catch (e) {
    logger.warn(`No cosmetics loaded from ${file}:`, e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Carga todos los `*.duck.json` de la carpeta. Un archivo inválido se omite con un aviso. */
export function loadCatalog(dir: string, logger: Logger): Catalog {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.duck.json'));
  } catch {
    logger.warn(`Catalog folder not found: ${dir}`);
  }
  const entries = files.flatMap((file) => {
    try {
      return parseCatalogFile(JSON.parse(readFileSync(join(dir, file), 'utf8')), file.replace(/\.duck\.json$/, ''));
    } catch (e) {
      logger.warn(`Skipping catalog file ${file}:`, e instanceof Error ? e.message : e);
      return [];
    }
  });
  return createCatalog(entries);
}
