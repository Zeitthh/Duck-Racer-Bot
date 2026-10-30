// Accesorios (cosméticos) en el formato de duck-editor (src/core/accessories.ts), solo para el pato 8×8. El dibujo de
// cada accesorio no está en el código: se carga de un archivo `accessories.json` (ver `parseAccessories`).
import { z } from 'zod';
import { DUCK_SIZE, FACE_COUNT, type Appearance } from './types';

/** Lado del lienzo con margen: el pato 8×8 queda centrado con 4 px libres por lado para el accesorio. */
export const CANVAS = DUCK_SIZE * 2;
const OFFSET = (CANVAS - DUCK_SIZE) / 2;

/** Una cara de un accesorio: dos capas de 16 filas × 16 caracteres ('.' = vacío, letra = un color). */
export interface FaceArt {
  /** Detrás del pato (solo se ve donde el pato es transparente). */
  under: string[];
  /** Encima del pato. */
  over: string[];
}

export interface AccessoryDef {
  id: string;
  names: { 'en-US': string; 'es-419': string };
  /** Letra del color principal: el único que se puede cambiar. */
  main: string;
  defaultColor: string;
  /** Letras que son un tono del principal: letra -> factor de brillo (0.6 = más oscuro). */
  shades: Record<string, number>;
  /** Colores fijos de las demás letras. */
  fixed: Record<string, string>;
  /** Una por cara, en el orden de FACE_NAMES. */
  faces: FaceArt[];
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const letter = z.string().length(1);
const rows = z.array(z.string().length(CANVAS)).length(CANVAS);
const accessorySchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/, 'only lowercase letters, numbers, - and _'),
  names: z.object({ 'en-US': z.string().min(1), 'es-419': z.string().min(1) }),
  main: letter,
  defaultColor: hex,
  shades: z.record(letter, z.number().positive()),
  fixed: z.record(letter, hex),
  faces: z.array(z.object({ under: rows, over: rows })).length(FACE_COUNT),
});

/**
 * Valida el contenido de `accessories.json`: una lista de accesorios con su id, sus nombres en en-US y es-419, el color
 * principal y las 4 caras (derecha, frente, izquierda, espalda), cada una con dos capas de 16 filas × 16 caracteres.
 * Lanza Error explicando qué falla.
 */
export function parseAccessories(raw: unknown): AccessoryDef[] {
  const parsed = z.array(accessorySchema).safeParse(raw);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  const ids = new Set<string>();
  for (const a of parsed.data) {
    if (ids.has(a.id)) throw new Error(`Duplicate accessory id: ${a.id}`);
    ids.add(a.id);
  }
  return parsed.data;
}

/** Los accesorios cargados (vacía hasta que se llama a `setAccessories`). Es siempre la misma lista. */
export const ACCESSORIES: AccessoryDef[] = [];
const byId = new Map<string, AccessoryDef>();

/** Reemplaza los accesorios disponibles. Se llama una vez al arrancar, con el resultado de `parseAccessories`. */
export function setAccessories(list: AccessoryDef[]) {
  ACCESSORIES.splice(0, ACCESSORIES.length, ...list);
  byId.clear();
  for (const a of list) byId.set(a.id, a);
}

export const getAccessory = (id: string | null | undefined) => (id ? (byId.get(id) ?? null) : null);

/** Los 12 colores que se pueden elegir para un accesorio. */
export const ACCESSORY_COLORS = [
  { id: 'black', hex: '#000000' },
  { id: 'white', hex: '#ffffff' },
  { id: 'yellow', hex: '#ffd21f' },
  { id: 'orange', hex: '#ff8c00' },
  { id: 'red', hex: '#e03131' },
  { id: 'pink', hex: '#ff8fc7' },
  { id: 'purple', hex: '#7e3fbf' },
  { id: 'blue', hex: '#2f7fe0' },
  { id: 'lightBlue', hex: '#7fd4ff' },
  { id: 'green', hex: '#3aa655' },
  { id: 'darkGreen', hex: '#1f5b3a' },
  { id: 'brown', hex: '#7a4b2a' },
] as const;
export type AccessoryColorId = (typeof ACCESSORY_COLORS)[number]['id'];

export const isAccessoryColor = (hex: unknown): hex is string =>
  typeof hex === 'string' && ACCESSORY_COLORS.some((c) => c.hex === hex);

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(Math.min(255, ((n >> shift) & 255) * factor));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/** Color de cada letra del accesorio. `main` = color principal elegido (o el de por defecto). */
export function accessoryColors(acc: AccessoryDef, main?: string | null): Record<string, string> {
  const m = isAccessoryColor(main) ? main : acc.defaultColor;
  const out: Record<string, string> = { ...acc.fixed, [acc.main]: m };
  for (const [letter, factor] of Object.entries(acc.shades)) out[letter] = shade(m, factor);
  return out;
}

/** Lo que hace falta para dibujar un pato: su apariencia y, si tiene, su accesorio con el color elegido. */
export interface DuckLook {
  appearance: Appearance;
  accessory?: AccessoryDef | null;
  accessoryColor?: string | null;
}

/** Una cara del pato con su accesorio en el lienzo de CANVAS × CANVAS: under -> pato -> over. null = transparente. */
export function composeFace({ appearance, accessory, accessoryColor }: DuckLook, face: number): (string | null)[] {
  const cells = new Array<string | null>(CANVAS * CANVAS).fill(null);
  const art = accessory?.faces[face];
  const colors = accessory ? accessoryColors(accessory, accessoryColor) : {};
  const paintLayer = (rows: string[] | undefined) =>
    rows?.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const c = ch === '.' ? undefined : colors[ch];
        if (c) cells[y * CANVAS + x] = c;
      }),
    );

  paintLayer(art?.under);
  appearance.frames[face]?.forEach((v, i) => {
    const c = v ? appearance.palette[v - 1] : undefined;
    if (c) cells[(Math.floor(i / DUCK_SIZE) + OFFSET) * CANVAS + (i % DUCK_SIZE) + OFFSET] = c;
  });
  paintLayer(art?.over);
  return cells;
}
