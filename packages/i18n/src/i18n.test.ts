import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES, discordLocalizations, resolveLocale, t } from './index';

/** Todas las hojas como [ruta, texto]. */
function leaves(node: unknown, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('messages', () => {
  const reference = new Map(leaves(MESSAGES['en-US']));

  it.each(LOCALES)('%s has no empty texts and the same placeholders as en-US', (locale) => {
    const entries = leaves(MESSAGES[locale]);
    expect(entries.map(([k]) => k).sort()).toEqual([...reference.keys()].sort());
    for (const [key, text] of entries) {
      expect(text.trim(), key).not.toBe('');
      expect(placeholders(text), key).toEqual(placeholders(reference.get(key)!));
    }
  });

  it.each(LOCALES)('%s command names and descriptions follow the Discord rules', (locale) => {
    for (const [key, text] of leaves(MESSAGES[locale].commands)) {
      if (key.endsWith('.name')) expect(text, key).toMatch(/^[-_\p{Ll}\p{Lo}\p{N}]{1,32}$/u);
      if (key.endsWith('.description')) expect(text.length, key).toBeLessThanOrEqual(100);
    }
  });
});

describe('t', () => {
  it('replaces variables and keeps unknown ones', () => {
    expect(t('es-419', 'ping.reply', { ms: 42 })).toBe('¡Pong! 🏓 Latencia: 42 ms');
    expect(t('en-US', 'ping.reply')).toBe('Pong! 🏓 Latency: {ms} ms');
  });
});

describe('resolveLocale', () => {
  it('maps Discord locales to ours', () => {
    expect(resolveLocale('es-ES')).toBe('es-419');
    expect(resolveLocale('es-419')).toBe('es-419');
    expect(resolveLocale('en-GB')).toBe('en-US');
    expect(resolveLocale('fr')).toBeNull();
    expect(resolveLocale(undefined)).toBeNull();
  });
});

describe('discordLocalizations', () => {
  it('gives every Discord locale its translation', () => {
    expect(discordLocalizations('commands.adopt.name')).toEqual({
      'en-US': 'adopt',
      'en-GB': 'adopt',
      'es-ES': 'adoptar',
      'es-419': 'adoptar',
    });
  });
});
