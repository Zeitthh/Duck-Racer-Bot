// Codificador de PNG mínimo (RGBA, 8 bits, sin filtro), copiado de duck-editor (scripts/png.ts).
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, k) => {
  let c = k;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b: Buffer) => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};

export type Rgb = [number, number, number];

export const hexToRgb = (c: string): Rgb => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

export interface Image {
  W: number;
  H: number;
  /** W × H × 4 bytes (RGBA). */
  px: Buffer;
  fill: (x: number, y: number, w: number, h: number, rgb: Rgb) => void;
}

/** Lienzo con un color de fondo (o transparente si `bg` es null). */
export function newImage(W: number, H: number, bg: string | null): Image {
  const px = Buffer.alloc(W * H * 4);
  const fill = (x0: number, y0: number, w: number, h: number, rgb: Rgb) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
        const i = (y * W + x) * 4;
        px[i] = rgb[0];
        px[i + 1] = rgb[1];
        px[i + 2] = rgb[2];
        px[i + 3] = 255;
      }
  };
  if (bg) fill(0, 0, W, H, hexToRgb(bg));
  return { W, H, px, fill };
}

export function encodePng({ W, H, px }: Image): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
