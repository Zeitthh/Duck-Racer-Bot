import { describe, expect, it } from 'vitest';
import {
  BASE_PALETTE,
  DUCK_SIZE,
  FACE_COUNT,
  MEXICAN_BIRDS,
  applyPattern,
  defaultFrames,
  mulberry32,
  parseAppearance,
  parseCatalogFile,
  randomAppearance,
  serializeAppearance,
  slugify,
  validateDuckName,
} from './index';

describe('template', () => {
  it('has 4 faces of 8×8 that only use the base palette', () => {
    const frames = defaultFrames();
    expect(frames).toHaveLength(FACE_COUNT);
    for (const f of frames) {
      expect(f).toHaveLength(DUCK_SIZE * DUCK_SIZE);
      expect(f.every((v) => v >= 0 && v <= BASE_PALETTE.length)).toBe(true);
    }
  });
});

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('appearance', () => {
  it('gives the same duck for the same seed and a different one for another seed', () => {
    expect(randomAppearance(123)).toEqual(randomAppearance(123));
    expect(randomAppearance(123).palette).not.toEqual(randomAppearance(124).palette);
  });

  it('paints the body with the 4 zone colors and keeps the outline black', () => {
    const a = applyPattern({ name: 'x', crown: '#111111', face: '#222222', chest: '#333333', belly: '#444444' });
    expect(a.palette).toEqual([...BASE_PALETTE, '#111111', '#222222', '#333333', '#444444']);
    const front = a.frames[1]!;
    expect(front[1 * DUCK_SIZE + 2]).toBe(1); // silueta (fila 1)
    expect(front[2 * DUCK_SIZE + 2]).toBe(4); // coronilla (fila 2)
    expect(front[5 * DUCK_SIZE + 2]).toBe(7); // vientre (fila 5)
  });

  it('round-trips through JSON and rejects broken data', () => {
    const a = randomAppearance(9);
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
    expect(() => parseAppearance(JSON.stringify({ palette: ['#000000'], frames: [[1]] }))).toThrow();
    expect(() => parseAppearance(JSON.stringify({ ...a, palette: ['#000000'] }))).toThrow();
  });
});

describe('catalog', () => {
  const duckEditorDuck = (name: string) => {
    const a = applyPattern(MEXICAN_BIRDS[0]!);
    return { id: 'x', name, size: 8, palette: a.palette, frames: { 8: a.frames, 16: [] }, accessory: null };
  };

  it('reads a duck-editor project and builds unique ids', () => {
    const entries = parseCatalogFile(
      { version: 1, fps: 6, ducks: [duckEditorDuck('Trogón mexicano'), duckEditorDuck('Trogón mexicano')] },
      'Aves México',
    );
    expect(entries.map((e) => e.id)).toEqual(['aves-mexico/trogon-mexicano', 'aves-mexico/trogon-mexicano-2']);
    expect(entries[0]!.appearance.frames).toHaveLength(FACE_COUNT);
  });

  it('rejects files that are not duck-editor projects', () => {
    expect(() => parseCatalogFile({ ducks: [] }, 'x')).toThrow();
    expect(() => parseCatalogFile({ version: 1, ducks: [{ name: 'a', frames: { 8: [[1]] } }] }, 'x')).toThrow();
  });

  it('slugifies names without accents', () => {
    expect(slugify('Colibrí garganta de rubí')).toBe('colibri-garganta-de-rubi');
    expect(slugify('***')).toBe('duck');
  });
});

describe('validateDuckName', () => {
  it('trims and collapses spaces', () => {
    expect(validateDuckName('  Pato   Lucas ')).toEqual({ ok: true, name: 'Pato Lucas' });
  });

  it('rejects empty, long and control-character names', () => {
    expect(validateDuckName('   ')).toEqual({ ok: false, error: 'empty' });
    expect(validateDuckName('a'.repeat(21))).toEqual({ ok: false, error: 'tooLong' });
    expect(validateDuckName('a​b')).toEqual({ ok: false, error: 'invalid' });
  });

  it('counts emoji as characters, not UTF-16 units', () => {
    expect(validateDuckName('🦆'.repeat(20)).ok).toBe(true);
  });
});
