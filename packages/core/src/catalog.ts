import { appearanceSchema } from './appearance';
import { DUCK_SIZE } from './types';
import type { Appearance } from './types';

/** Un pato del catálogo: se elige al adoptar en lugar de uno aleatorio. */
export interface CatalogEntry {
  /** Único en todo el catálogo: "<archivo>/<nombre>", p. ej. "aves-mexico/quetzal". */
  id: string;
  name: string;
  appearance: Appearance;
}

export function slugify(name: string, fallback = 'duck'): string {
  const s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

/**
 * Lee un proyecto exportado de duck-editor (`*.duck.json`). Solo usa la versión 8×8 de cada pato.
 * `file` es el nombre del archivo sin extensión y sirve de prefijo para los ids. Lanza Error si el archivo no es válido.
 */
export function parseCatalogFile(data: unknown, file: string): CatalogEntry[] {
  const o = data as { version?: unknown; ducks?: unknown } | null;
  if (!o || typeof o !== 'object' || o.version !== 1 || !Array.isArray(o.ducks))
    throw new Error(`${file}: not a duck-editor project`);

  const prefix = slugify(file, 'catalog');
  const seen = new Map<string, number>();
  return o.ducks.map((raw, i): CatalogEntry => {
    const d = raw as { name?: unknown; palette?: unknown; frames?: unknown } | null;
    if (!d || typeof d.name !== 'string' || !d.frames || typeof d.frames !== 'object')
      throw new Error(`${file}, duck ${i + 1}: invalid structure`);
    // Formato actual: { "8": [...], "16": [...] }. Formato anterior: una lista de caras de un solo tamaño.
    const frames = Array.isArray(d.frames) ? d.frames : (d.frames as Record<string, unknown>)[String(DUCK_SIZE)];
    const palette = Array.isArray(d.palette)
      ? d.palette.map((c) => (typeof c === 'string' ? c.toLowerCase() : c))
      : d.palette;
    const parsed = appearanceSchema.safeParse({ palette, frames });
    if (!parsed.success) throw new Error(`${file}, duck "${d.name}": invalid 8×8 frames or palette`);

    const base = slugify(d.name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { id: `${prefix}/${n === 1 ? base : `${base}-${n}`}`, name: d.name, appearance: parsed.data };
  });
}
