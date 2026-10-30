// Patrones de color de duck-editor (src/core/randomize.ts), con semilla para que sean reproducibles.
import { z } from 'zod';
import { mulberry32 } from './random';
import { BASE_PALETTE, defaultFrames, isBodyCell } from './template';
import { DUCK_SIZE, FACE_COUNT, type Appearance } from './types';

/** Patrón de color por zonas: coronilla, cara, pecho y vientre. El pico y el ojo no cambian. */
export interface DuckPattern {
  name: string;
  /** Familia o grupo, para agrupar en catálogos. */
  group?: string;
  crown: string;
  face: string;
  chest: string;
  belly: string;
}

const hsl = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** Patrón inventado a partir de un tono al azar, con colores que combinan entre sí. */
export function fantasyPattern(seed: number): DuckPattern {
  const h = mulberry32(seed)() * 360;
  const c = (dh: number, l: number) => hsl((h + dh + 360) % 360, 0.65, l);
  return { name: 'Fantasy', crown: c(0, 0.5), face: c(40, 0.75), chest: c(180, 0.6), belly: c(20, 0.4) };
}

/** Pato blanco con el patrón aplicado a sus 4 caras. */
export function applyPattern(p: DuckPattern): Appearance {
  const palette = BASE_PALETTE.slice();
  const indexOf = (hex: string) => {
    let i = palette.indexOf(hex);
    if (i < 0) i = palette.push(hex) - 1;
    return i + 1;
  };
  const zones = [p.crown, p.face, p.chest, p.belly].map(indexOf);
  const frames = defaultFrames().map((frame, face) =>
    frame.map((v, i) => {
      const x = i % DUCK_SIZE;
      const y = Math.floor(i / DUCK_SIZE);
      if (!isBodyCell(face, x, y)) return v;
      return zones[y <= 2 ? 0 : y === 3 ? 1 : y === 4 ? 2 : 3]!;
    }),
  );
  return { palette, frames };
}

/** Apariencia aleatoria y reproducible a partir de una semilla. */
export const randomAppearance = (seed: number): Appearance => applyPattern(fantasyPattern(seed));

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/);

export const appearanceSchema = z
  .object({
    palette: z.array(hexColor).min(1).max(32),
    frames: z.array(z.array(z.number().int().min(0))).length(FACE_COUNT),
  })
  .refine(
    (a) => a.frames.every((f) => f.length === DUCK_SIZE * DUCK_SIZE && f.every((v) => v <= a.palette.length)),
    'Each frame must be 8×8 and only use indices of the palette',
  );

/** Lee una apariencia guardada como JSON. Lanza un error si no es válida. */
export const parseAppearance = (json: string): Appearance => appearanceSchema.parse(JSON.parse(json));

export const serializeAppearance = (a: Appearance): string => JSON.stringify(a);
