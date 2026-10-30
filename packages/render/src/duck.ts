import { CANVAS, FACE_COUNT, TRACK_LENGTH, composeFace, type DuckLook, type RaceResult } from '@duckbot/core';
import { encodeGif } from './gif';
import { encodePng, hexToRgb, newImage } from './png';

/** Fondos pastel de duck-editor (src/core/palette.ts). */
export const PASTEL_BACKGROUNDS = [
  '#ffadad',
  '#ffd6a5',
  '#fdffb6',
  '#caffbf',
  '#9bf6ff',
  '#a0c4ff',
  '#bdb2ff',
  '#ffc6ff',
] as const;

/** Un fondo pastel estable para una clave (p. ej. el id del pato): siempre el mismo para la misma clave. */
export function backgroundFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return PASTEL_BACKGROUNDS[h % PASTEL_BACKGROUNDS.length]!;
}

export interface RenderOptions {
  /** Píxeles de pantalla por píxel del pato. */
  scale?: number;
  /** Color "#rrggbb" del fondo, o null para transparente. */
  background?: string | null;
}

/** PNG con las 4 caras del pato (y su accesorio) en fila: derecha, frente, izquierda, espalda. */
export function renderDuckStrip(look: DuckLook, { scale = 8, background = null }: RenderOptions = {}): Buffer {
  const cell = CANVAS * scale;
  const img = newImage(cell * FACE_COUNT, cell, background);
  for (let face = 0; face < FACE_COUNT; face++)
    composeFace(look, face).forEach((color, i) => {
      if (color)
        img.fill(face * cell + (i % CANVAS) * scale, Math.floor(i / CANVAS) * scale, scale, scale, hexToRgb(color));
    });
  return encodePng(img);
}

/** Dígitos de 3×5 píxeles (filas de arriba abajo) para numerar los patos de una galería. */
const DIGITS = [
  '111101101101111',
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
  '111100111101111',
  '111001001001001',
  '111101111101111',
  '111101111001111',
];
const SHEET_BG = '#2b2d31';
const LABEL = '#222222';

export interface SheetItem {
  look: DuckLook;
  /** Color "#rrggbb" del fondo de su casilla. */
  background: string;
}

/**
 * PNG con varios patos de frente en cuadrícula, cada uno en su casilla y numerado desde `firstNumber`
 * (para que el número coincida con el de la lista del mensaje).
 */
export function renderDuckSheet(
  items: SheetItem[],
  { columns = 4, scale = 5, firstNumber = 1 }: { columns?: number; scale?: number; firstNumber?: number } = {},
): Buffer {
  const cell = CANVAS * scale;
  const gap = scale * 2;
  const cols = Math.max(1, Math.min(columns, items.length));
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const img = newImage(cols * cell + (cols + 1) * gap, rows * cell + (rows + 1) * gap, SHEET_BG);
  const dot = Math.max(1, Math.floor(scale / 2));

  items.forEach(({ look, background }, i) => {
    const x0 = gap + (i % cols) * (cell + gap);
    const y0 = gap + Math.floor(i / cols) * (cell + gap);
    img.fill(x0, y0, cell, cell, hexToRgb(background));
    // Cara 1 = de frente.
    composeFace(look, 1).forEach((color, p) => {
      if (color)
        img.fill(x0 + (p % CANVAS) * scale, y0 + Math.floor(p / CANVAS) * scale, scale, scale, hexToRgb(color));
    });
    [...String(firstNumber + i)].forEach((ch, d) => {
      const glyph = DIGITS[Number(ch)]!;
      for (let p = 0; p < 15; p++)
        if (glyph[p] === '1')
          img.fill(x0 + dot * (1 + d * 4 + (p % 3)), y0 + dot * (1 + Math.floor(p / 3)), dot, dot, hexToRgb(LABEL));
    });
  });
  return encodePng(img);
}

/** Paleta de un GIF que se va llenando con los colores que aparecen. */
class GifPalette {
  readonly colors: string[] = [];
  private readonly index = new Map<string, number>();
  constructor(first: string) {
    this.of(first);
  }
  of(hex: string): number {
    let i = this.index.get(hex);
    if (i === undefined) {
      i = this.colors.push(hex) - 1;
      this.index.set(hex, i);
    }
    return i;
  }
}

/** GIF animado del pato (con su accesorio) girando: las 4 caras en bucle. */
export function renderDuckGif(
  look: DuckLook,
  { scale = 12, background = null, fps = 4 }: RenderOptions & { fps?: number } = {},
): Buffer {
  const px = CANVAS * scale;
  // Índice 0 = fondo (transparente si no hay color de fondo).
  const palette = new GifPalette(background ?? '#000000');
  const frames = Array.from({ length: FACE_COUNT }, (_, face) => {
    const cells = composeFace(look, face).map((c) => (c ? palette.of(c) : 0));
    const out = new Uint8Array(px * px);
    for (let y = 0; y < px; y++)
      for (let x = 0; x < px; x++) out[y * px + x] = cells[Math.floor(y / scale) * CANVAS + Math.floor(x / scale)]!;
    return out;
  });
  return encodeGif({
    width: px,
    height: px,
    palette: palette.colors,
    frames,
    delayCs: Math.round(100 / fps),
    transparentIndex: background ? undefined : 0,
  });
}

const TRACK = {
  grass: '#7bc96f',
  laneA: '#ecdcaa',
  laneB: '#dfcd96',
  line: '#ffffff',
  checkerDark: '#222222',
  checkerLight: '#ffffff',
};

export interface RaceGifOptions {
  scale?: number;
  width?: number;
  /** Centésimas de segundo por tick de la simulación. */
  delayCs?: number;
  /** Cuadros extra al final con el resultado quieto. */
  holdFrames?: number;
}

/**
 * GIF de una carrera: un carril por pato (en el orden de `racers`), de izquierda a derecha hasta la meta.
 * `result` es la salida de simulateRace para esos mismos patos.
 */
export function renderRaceGif(
  racers: DuckLook[],
  result: RaceResult,
  { scale = 4, width = 640, delayCs = 10, holdFrames = 20 }: RaceGifOptions = {},
): Buffer {
  const duckPx = CANVAS * scale;
  const margin = 8;
  const laneH = duckPx;
  const height = margin * 2 + laneH * racers.length;
  const finishX = width - 24;
  const startX = margin;
  // Cuando llega a la meta, el pico (≈ 3/4 del lienzo) toca la línea.
  const run = finishX - startX - Math.round(duckPx * 0.75);

  const palette = new GifPalette(TRACK.grass);
  const c = Object.fromEntries(Object.entries(TRACK).map(([k, v]) => [k, palette.of(v)])) as Record<
    keyof typeof TRACK,
    number
  >;

  // Pista sin patos (se copia en cada cuadro).
  const track = new Uint8Array(width * height).fill(c.grass);
  racers.forEach((_, lane) => {
    const y0 = margin + lane * laneH;
    for (let y = y0; y < y0 + laneH; y++) {
      const color = y === y0 ? c.line : lane % 2 ? c.laneB : c.laneA;
      track.fill(color, y * width + startX, y * width + width - margin);
    }
  });
  for (let y = margin; y < height - margin; y++)
    for (let x = finishX; x < finishX + 8; x++)
      track[y * width + x] = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? c.checkerDark : c.checkerLight;

  // Cada pato mirando a la derecha (cara 0), como índices de paleta (−1 = transparente).
  const sprites = racers.map((look) => composeFace(look, 0).map((col) => (col ? palette.of(col) : -1)));

  const drawFrame = (positions: number[], tick: number) => {
    const out = track.slice();
    positions.forEach((p, lane) => {
      const running = p < TRACK_LENGTH && tick > 0;
      // Contoneo: sube y baja un píxel del pato mientras corre.
      const bob = running && (tick + lane) % 2 ? -scale : 0;
      const ox = startX + Math.round((p / TRACK_LENGTH) * run);
      const oy = margin + lane * laneH + bob;
      sprites[lane]!.forEach((v, i) => {
        if (v < 0) return;
        const sx = ox + (i % CANVAS) * scale;
        const sy = oy + Math.floor(i / CANVAS) * scale;
        for (let y = Math.max(0, sy); y < Math.min(height, sy + scale); y++)
          out.fill(v, y * width + Math.max(0, sx), y * width + Math.min(width, sx + scale));
      });
    });
    return out;
  };

  const frames = result.ticks.map((positions, tick) => drawFrame(positions, tick));
  const last = frames.at(-1)!;
  for (let i = 0; i < holdFrames; i++) frames.push(last);
  return encodeGif({ width, height, palette: palette.colors, frames, delayCs });
}
