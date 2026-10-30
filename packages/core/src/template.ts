// Plantilla del pato 8×8, copiada de duck-editor (src/core/template.ts).
import { DUCK_SIZE, type Frame } from './types';

/**
 *   K = silueta negra  -> índice 1     E = ojo negro -> índice 1
 *   W = blanco -> 2    O = naranja (pico) -> 3
 */
const RIGHT = ['........', '...KKK..', '..KWWWK.', 'KKKWEWOK', 'KWWWWWK.', '.KWWWWK.', '..KKKK..', '........'];
const FRONT = ['........', '..KKK...', '.KWWWK..', '.KOOOK..', 'KWWWWWK.', 'KWWWWWK.', '.KKKKK..', '........'];

const flipRows = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));
/** De espaldas no se ven ni el pico ni el ojo. */
const back = (rows: string[]) => rows.map((r) => r.replace(/[EO]/g, 'W'));

/** Orden de FACE_NAMES: right, front, left, back. */
const TEMPLATES: string[][] = [RIGHT, FRONT, flipRows(RIGHT), back(FRONT)];

const CODES: Record<string, number> = { '.': 0, K: 1, E: 1, W: 2, O: 3 };

/** Paleta base: negro, blanco y naranja. */
export const BASE_PALETTE = ['#000000', '#ffffff', '#ff8c00'];

/** Cara de un pato blanco. Usa los índices 1..3 de BASE_PALETTE. */
export const defaultFrame = (face: number): Frame =>
  (TEMPLATES[face] ?? []).flatMap((row) => [...row].map((c) => CODES[c] ?? 0));

export const defaultFrames = (): Frame[] => TEMPLATES.map((_, face) => defaultFrame(face));

/** ¿La celda es cuerpo o cabeza pintable (blanco en la plantilla, sin pico ni ojo)? */
export const isBodyCell = (face: number, x: number, y: number) => TEMPLATES[face]?.[y]?.[x] === 'W';

export const cellIndex = (x: number, y: number) => y * DUCK_SIZE + x;
