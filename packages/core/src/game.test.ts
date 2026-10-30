import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ACCESSORIES,
  CANVAS,
  DUCK_SIZE,
  MAX_DUCK_LEVEL,
  TRACK_LENGTH,
  accessoryColors,
  composeFace,
  dayKey,
  getAccessory,
  isValidTimeZone,
  levelFromXp,
  levelProgress,
  levelUpReward,
  messageXp,
  nextMidnight,
  parseAccessories,
  progressBar,
  racePrize,
  randomAppearance,
  setAccessories,
  simulateRace,
  releaseRefund,
  trainCost,
  trainedCoins,
  xpForLevel,
} from './index';

// El arte de los cosméticos no está en el código: se carga de un archivo. Los tests usan el ejemplo del repositorio.
const SAMPLE = fileURLToPath(new URL('../../../assets/accessories.json', import.meta.url));

describe('accessories', () => {
  beforeAll(() => setAccessories(parseAccessories(JSON.parse(readFileSync(SAMPLE, 'utf8')))));

  it('loads the sample file: 4 faces of 16×16 and names in both languages', () => {
    expect(ACCESSORIES.length).toBeGreaterThan(0);
    expect(getAccessory('cap')).not.toBeNull();
    for (const a of ACCESSORIES) {
      expect(a.faces).toHaveLength(4);
      for (const f of a.faces)
        for (const rows of [f.under, f.over]) {
          expect(rows).toHaveLength(CANVAS);
          expect(rows.every((r) => r.length === CANVAS)).toBe(true);
        }
      expect(a.names['es-419']).not.toBe('');
    }
  });

  it('rejects files that do not follow the format', () => {
    const cap = JSON.parse(readFileSync(SAMPLE, 'utf8'))[0];
    expect(() => parseAccessories({})).toThrow();
    expect(() => parseAccessories([cap, cap])).toThrow(/Duplicate/);
    expect(() => parseAccessories([{ ...cap, faces: cap.faces.slice(0, 3) }])).toThrow();
    expect(() => parseAccessories([{ ...cap, names: { 'en-US': 'Cap' } }])).toThrow();
    const short = structuredClone(cap);
    short.faces[0].over[0] = '...';
    expect(() => parseAccessories([short])).toThrow();
  });

  it('has no accessories until some are loaded', () => {
    setAccessories([]);
    expect(ACCESSORIES).toHaveLength(0);
    expect(getAccessory('cap')).toBeNull();
    setAccessories(parseAccessories(JSON.parse(readFileSync(SAMPLE, 'utf8'))));
    expect(getAccessory('cap')).not.toBeNull();
  });

  it('uses the chosen main color and darker shades', () => {
    const hat = getAccessory('cap')!;
    const colors = accessoryColors(hat, '#e03131');
    expect(colors[hat.main]).toBe('#e03131');
    expect(accessoryColors(hat, '#123456')[hat.main]).toBe(hat.defaultColor); // color no permitido
  });

  it('draws the duck centered and the accessory over it', () => {
    const appearance = randomAppearance(3);
    const plain = composeFace({ appearance }, 1);
    expect(plain).toHaveLength(CANVAS * CANVAS);
    const off = (CANVAS - DUCK_SIZE) / 2;
    // Fila 1, columna 2 del pato de frente = silueta negra.
    expect(plain[(1 + off) * CANVAS + 2 + off]).toBe('#000000');

    const withHat = composeFace({ appearance, accessory: getAccessory('cap') }, 1);
    expect(withHat.filter(Boolean).length).toBeGreaterThan(plain.filter(Boolean).length);
  });
});

describe('progression', () => {
  it('follows the XP curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(4500)).toBe(10);
    expect(levelProgress(150)).toEqual({ level: 2, current: 50, needed: 200 });
  });

  it('applies event multipliers', () => {
    expect(messageXp()).toBe(10);
    expect(messageXp(1.5)).toBe(15);
    expect(messageXp(2)).toBe(20);
  });

  it('draws a progress bar', () => {
    expect(progressBar(5, 10)).toBe('▰▰▰▰▰▱▱▱▱▱');
    expect(progressBar(0, 0)).toBe('▱▱▱▱▱▱▱▱▱▱');
  });
});

describe('simulateRace', () => {
  const racers = [{ level: 1 }, { level: 5 }, { level: 10 }, { level: 1 }];

  it('is reproducible from its seed', () => {
    expect(simulateRace(racers, 99)).toEqual(simulateRace(racers, 99));
    expect(simulateRace(racers, 99).order).toHaveLength(4);
  });

  it('ends with every duck at the finish line, in order of arrival', () => {
    const r = simulateRace(racers, 7);
    expect(r.ticks.at(-1)!.every((p) => p === TRACK_LENGTH)).toBe(true);
    const sortedTimes = r.order.map((i) => r.times[i]!);
    expect([...sortedTimes].sort((a, b) => a - b)).toEqual(sortedTimes);
  });

  it('gives higher levels an advantage without deciding the race', () => {
    let highWins = 0;
    for (let seed = 0; seed < 1000; seed++)
      if (simulateRace([{ level: 1 }, { level: 30 }], seed).order[0] === 1) highWins++;
    // El de nivel alto gana más, pero el de nivel 1 todavía gana una de cada cuatro o más.
    expect(highWins).toBeGreaterThan(550);
    expect(highWins).toBeLessThan(800);
  });

  it('pays prizes by position', () => {
    expect([1, 2, 3, 4, 8].map((p) => racePrize(p))).toEqual([50, 30, 20, 10, 10]);
  });

  it('pays coins per player level and charges more to train higher ducks', () => {
    expect(levelUpReward(2)).toBe(20);
    expect(trainCost(1)).toBe(50);
    expect(Array.from({ length: MAX_DUCK_LEVEL - 1 }, (_, i) => trainCost(i + 1)).reduce((a, b) => a + b)).toBe(9500);
    expect(trainedCoins(MAX_DUCK_LEVEL)).toBe(9500);
    expect(trainedCoins(1)).toBe(0);
    // Liberar devuelve la mitad: nivel 3 costó 50 + 100.
    expect(releaseRefund(3)).toBe(75);
    expect(releaseRefund(1)).toBe(0);
  });

  it('raises prizes with each extra player', () => {
    expect(racePrize(1, 2)).toBe(63);
    expect(racePrize(1, 8)).toBe(138);
    expect(racePrize(5, 8)).toBe(28);
  });
});

describe('time zones', () => {
  it('validates IANA names', () => {
    expect(isValidTimeZone('America/Mexico_City')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('computes the local day', () => {
    const t = new Date('2026-10-30T03:00:00Z'); // 21:00 del 29 en Ciudad de México (UTC−6)
    expect(dayKey(t, 'America/Mexico_City')).toBe('2026-10-29');
    expect(dayKey(t, 'Europe/Madrid')).toBe('2026-10-30');
  });

  it('finds the next local midnight', () => {
    const t = new Date('2026-10-30T03:00:00Z');
    expect(nextMidnight(t, 'America/Mexico_City').toISOString()).toBe('2026-10-30T06:00:00.000Z');
    expect(nextMidnight(t, 'UTC').toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });
});
