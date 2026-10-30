// Genera assets/accessories.json: los cosméticos de ejemplo del repositorio, una gorra blanca y una gorra de cada color
// del arcoíris. Son genéricos: sirven para que el bot funcione y para ver el formato. Tu propio arte va en otra
// carpeta (ver ASSETS_DIR en el README). Uso: pnpm assets:sample
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANVAS, parseAccessories } from '@duckbot/core';

const blank = '.'.repeat(CANVAS);
const row = (from: number, to: number, ch: string) =>
  Array.from({ length: CANVAS }, (_, x) => (x >= from && x <= to ? ch : '.')).join('');
const layer = (rows: Record<number, string>) => Array.from({ length: CANVAS }, (_, y) => rows[y] ?? blank);

/** Una gorra: la copa en tono oscuro (D) y el color principal (C) debajo, con la visera hacia donde mira el pato. */
const face = (brim: 'right' | 'left' | 'none') => ({
  under: layer({}),
  over: layer({
    3: row(5, 10, 'D'),
    4: brim === 'right' ? row(4, 13, 'C') : brim === 'left' ? row(2, 11, 'C') : row(4, 11, 'C'),
  }),
});

// Orden de las caras: derecha, frente, izquierda, espalda.
const faces = [face('right'), face('none'), face('left'), face('none')];

const caps = [
  { id: 'cap', en: 'White cap', es: 'Gorra blanca', color: '#ffffff' },
  { id: 'cap-red', en: 'Red cap', es: 'Gorra roja', color: '#e03131' },
  { id: 'cap-orange', en: 'Orange cap', es: 'Gorra naranja', color: '#ff8c00' },
  { id: 'cap-yellow', en: 'Yellow cap', es: 'Gorra amarilla', color: '#ffd21f' },
  { id: 'cap-green', en: 'Green cap', es: 'Gorra verde', color: '#3aa655' },
  { id: 'cap-blue', en: 'Blue cap', es: 'Gorra azul', color: '#2f7fe0' },
  { id: 'cap-indigo', en: 'Indigo cap', es: 'Gorra índigo', color: '#4b3bbf' },
  { id: 'cap-violet', en: 'Violet cap', es: 'Gorra violeta', color: '#7e3fbf' },
].map(({ id, en, es, color }) => ({
  id,
  names: { 'en-US': en, 'es-419': es },
  main: 'C',
  defaultColor: color,
  shades: { D: 0.6 },
  fixed: {},
  faces,
}));

parseAccessories(caps); // comprueba que cumple el formato
const out = resolve(import.meta.dirname, '../assets/accessories.json');
writeFileSync(out, JSON.stringify(caps, null, 2) + '\n');
console.info(`${caps.length} accessories -> ${out}`);
