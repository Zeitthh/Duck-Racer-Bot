// Genera aves-mexico.duck.json en la carpeta del catálogo (ASSETS_DIR/catalog): un pato por ave de México, en el
// formato de duck-editor (se puede abrir con "Import" en el editor). Uso: pnpm catalog:birds
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MEXICAN_BIRDS, applyPattern, slugify } from '@duckbot/core';

const root = resolve(import.meta.dirname, '..');
// Lee ASSETS_DIR de .env (si existe), igual que el bot.
try {
  process.loadEnvFile(resolve(root, '.env'));
} catch {
  // Sin .env se usa la carpeta por defecto.
}
const dir = resolve(root, process.env.ASSETS_DIR ?? 'assets', 'catalog');
mkdirSync(dir, { recursive: true });

const ducks = MEXICAN_BIRDS.map((bird) => {
  const { palette, frames } = applyPattern(bird);
  return { id: slugify(bird.name), name: bird.name, size: 8, palette, frames: { 8: frames }, accessory: null };
});

const out = resolve(dir, 'aves-mexico.duck.json');
writeFileSync(out, JSON.stringify({ version: 1, fps: 6, ducks }, null, 2));
console.info(`${ducks.length} ducks -> ${out}`);
