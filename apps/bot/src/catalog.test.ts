import { MEXICAN_BIRDS, applyPattern } from '@duckbot/core';
import { describe, expect, it } from 'vitest';
import { createCatalog } from './catalog';

const entry = (id: string, name: string) => ({ id, name, appearance: applyPattern(MEXICAN_BIRDS[0]!) });

describe('catalog search', () => {
  const catalog = createCatalog([
    entry('aves/colibri-rufo', 'Colibrí rufo'),
    entry('aves/quetzal', 'Quetzal'),
    entry('aves/colibri-de-anna', 'Colibrí de Anna'),
  ]);

  it('ignores case and accents', () => {
    expect(catalog.search('COLIBRI').map((e) => e.id)).toEqual(['aves/colibri-rufo', 'aves/colibri-de-anna']);
  });

  it('returns everything (up to the limit) for an empty query', () => {
    expect(catalog.search('')).toHaveLength(3);
    expect(catalog.search('', 2)).toHaveLength(2);
  });

  it('finds entries by id', () => {
    expect(catalog.get('aves/quetzal')?.name).toBe('Quetzal');
    expect(catalog.get('nope')).toBeUndefined();
  });
});
