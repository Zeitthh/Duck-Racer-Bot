import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CANVAS, getAccessory, parseAccessories, randomAppearance, setAccessories, simulateRace } from '@duckbot/core';
import { describe, expect, it } from 'vitest';
import {
  PASTEL_BACKGROUNDS,
  backgroundFor,
  renderDuckGif,
  renderDuckSheet,
  renderDuckStrip,
  renderRaceGif,
} from './index';

// El arte de los cosméticos se carga de un archivo: aquí, el ejemplo del repositorio.
setAccessories(
  parseAccessories(
    JSON.parse(readFileSync(fileURLToPath(new URL('../../../assets/accessories.json', import.meta.url)), 'utf8')),
  ),
);
const look = { appearance: randomAppearance(1), accessory: getAccessory('cap'), accessoryColor: '#e03131' };

describe('renderDuckStrip', () => {
  it('produces a PNG with the 4 faces side by side', () => {
    const png = renderDuckStrip(look, { scale: 4 });
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    // IHDR: ancho y alto en los bytes 16..23
    expect(png.readUInt32BE(16)).toBe(4 * CANVAS * 4);
    expect(png.readUInt32BE(20)).toBe(CANVAS * 4);
  });
});

describe('renderDuckGif', () => {
  it('produces an animated GIF of the right size', () => {
    const gif = renderDuckGif(look, { scale: 4, background: '#ffadad' });
    expect(gif.subarray(0, 6).toString('ascii')).toBe('GIF89a');
    expect(gif.readUInt16LE(6)).toBe(CANVAS * 4);
    expect(gif.readUInt16LE(8)).toBe(CANVAS * 4);
    expect(gif.at(-1)).toBe(0x3b);
  });
});

describe('renderRaceGif', () => {
  it('draws one lane per duck', () => {
    const racers = [look, { appearance: randomAppearance(2) }, { appearance: randomAppearance(3) }];
    const gif = renderRaceGif(racers, simulateRace([{ level: 1 }, { level: 2 }, { level: 3 }], 1), {
      scale: 3,
      width: 400,
    });
    expect(gif.subarray(0, 6).toString('ascii')).toBe('GIF89a');
    expect(gif.readUInt16LE(6)).toBe(400);
    expect(gif.readUInt16LE(8)).toBe(16 + 3 * CANVAS * 3);
  });
});

describe('renderDuckSheet', () => {
  it('lays the ducks out in a grid', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      look: { appearance: randomAppearance(i) },
      background: '#caffbf',
    }));
    const png = renderDuckSheet(items, { columns: 4, scale: 5 });
    const cell = CANVAS * 5;
    const gap = 10;
    expect(png.readUInt32BE(16)).toBe(4 * cell + 5 * gap);
    expect(png.readUInt32BE(20)).toBe(2 * cell + 3 * gap);
  });
});

describe('backgroundFor', () => {
  it('is stable and always a pastel color', () => {
    expect(backgroundFor('abc')).toBe(backgroundFor('abc'));
    expect(PASTEL_BACKGROUNDS).toContain(backgroundFor('another id'));
  });
});
