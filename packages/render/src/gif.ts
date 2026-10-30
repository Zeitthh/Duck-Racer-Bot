/**
 * Codificador de GIF animado mínimo (GIF89a), sin dependencias. Copiado de duck-editor (src/core/gif.ts).
 * Una sola tabla de colores global, un color transparente opcional y bucle infinito.
 */

export interface GifOptions {
  width: number;
  height: number;
  /** Colores "#rrggbb"; los píxeles de cada cuadro son índices de esta lista. */
  palette: string[];
  /** Un arreglo width × height de índices por cuadro. */
  frames: Uint8Array[];
  /** Duración de cada cuadro en centésimas de segundo. */
  delayCs: number;
  /** Índice de paleta que se muestra transparente (p. ej. 0). */
  transparentIndex?: number;
  /** Repeticiones: 0 = infinito. */
  loop?: number;
}

const le16 = (n: number) => [n & 255, (n >> 8) & 255];

/** Bits necesarios para representar `count` valores (mínimo 1). */
function bitsFor(count: number): number {
  let bits = 1;
  while (1 << bits < count) bits++;
  return bits;
}

/** Compresión LZW de GIF (variante de omggif): devuelve los bytes ya partidos en sub-bloques. */
function lzw(indices: Uint8Array, minCodeSize: number): number[] {
  const out: number[] = [];
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let nextCode = eoi + 1;
  let codeSize = minCodeSize + 1;
  let table = new Map<number, number>();

  let block: number[] = [];
  let cur = 0;
  let shift = 0;
  const flush = () => {
    out.push(block.length, ...block);
    block = [];
  };
  const emit = (code: number) => {
    cur |= code << shift;
    shift += codeSize;
    while (shift >= 8) {
      block.push(cur & 255);
      cur >>= 8;
      shift -= 8;
      if (block.length === 255) flush();
    }
  };

  emit(clear);
  let prefix = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const key = (prefix << 8) | k;
    const found = table.get(key);
    if (found === undefined) {
      emit(prefix);
      if (nextCode === 4096) {
        // Tabla llena: se reinicia.
        emit(clear);
        nextCode = eoi + 1;
        codeSize = minCodeSize + 1;
        table = new Map();
      } else {
        if (nextCode >= 1 << codeSize) codeSize++;
        table.set(key, nextCode++);
      }
      prefix = k;
    } else {
      prefix = found;
    }
  }
  emit(prefix);
  emit(eoi);
  if (shift > 0) block.push(cur & 255);
  if (block.length) flush();
  out.push(0); // fin de los sub-bloques
  return out;
}

export function encodeGif(opts: GifOptions): Buffer {
  const { width, height, palette, frames, delayCs, transparentIndex, loop = 0 } = opts;
  if (palette.length < 1 || palette.length > 256) throw new Error('GIF: la paleta debe tener entre 1 y 256 colores');
  for (const f of frames) {
    if (f.length !== width * height) throw new Error('GIF: un cuadro no mide width × height');
    for (const v of f) if (v >= palette.length) throw new Error('GIF: índice fuera de la paleta');
  }

  const sizeBits = Math.max(2, bitsFor(palette.length)); // la tabla mide 2^sizeBits (mínimo 4)
  const tableLen = 1 << sizeBits;
  const bytes: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);

  push(...[...'GIF89a'].map((c) => c.charCodeAt(0)));
  push(...le16(width), ...le16(height), 0x80 | ((sizeBits - 1) << 4) | (sizeBits - 1), 0, 0);
  for (let i = 0; i < tableLen; i++) {
    const hex = palette[i] ?? '#000000';
    push(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  }
  // Bucle (NETSCAPE2.0)
  push(0x21, 0xff, 0x0b, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 0x03, 0x01, ...le16(loop), 0x00);

  const transparent = transparentIndex !== undefined;
  for (const f of frames) {
    // Disposal 2: cada cuadro borra el anterior (necesario para que el fondo transparente no deje rastros).
    push(
      0x21,
      0xf9,
      0x04,
      (2 << 2) | (transparent ? 1 : 0),
      ...le16(Math.max(2, delayCs)),
      transparentIndex ?? 0,
      0x00,
    );
    push(0x2c, 0, 0, 0, 0, ...le16(width), ...le16(height), 0x00);
    push(sizeBits, ...lzw(f, sizeBits));
  }
  push(0x3b);
  return Buffer.from(bytes);
}
