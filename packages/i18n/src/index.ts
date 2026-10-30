import { enUS } from './locales/en-US';
import { es419 } from './locales/es-419';
import type { MessageKey, Messages } from './types';

export type { MessageKey, Messages } from './types';

export const LOCALES = ['en-US', 'es-419'] as const;
export type Locale = (typeof LOCALES)[number];
export const FALLBACK_LOCALE: Locale = 'en-US';

export const MESSAGES: Record<Locale, Messages> = { 'en-US': enUS, 'es-419': es419 };

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** Idiomas de Discord que atendemos y el archivo de textos que usa cada uno. */
export const DISCORD_LOCALES = {
  'en-US': 'en-US',
  'en-GB': 'en-US',
  'es-ES': 'es-419',
  'es-419': 'es-419',
} as const satisfies Record<string, Locale>;
export type DiscordLocale = keyof typeof DISCORD_LOCALES;

/** El idioma nuestro para un código de Discord ("es-ES" -> "es-419"), o null si no lo tenemos. */
export function resolveLocale(discordLocale: string | null | undefined): Locale | null {
  if (!discordLocale) return null;
  if (discordLocale in DISCORD_LOCALES) return DISCORD_LOCALES[discordLocale as DiscordLocale];
  if (discordLocale.startsWith('es')) return 'es-419';
  if (discordLocale.startsWith('en')) return 'en-US';
  return null;
}

function lookup(messages: Messages, key: MessageKey): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : undefined;
}

/** Texto traducido. `{var}` se reemplaza por `vars.var`; si falta la variable, se deja tal cual. */
export function t(locale: Locale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const text = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[FALLBACK_LOCALE], key) ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Traducciones de un texto para cada idioma de Discord: para `setNameLocalizations` y `setDescriptionLocalizations`. */
export function discordLocalizations(key: MessageKey): Record<DiscordLocale, string> {
  return Object.fromEntries(
    Object.entries(DISCORD_LOCALES).map(([discord, locale]) => [discord, t(locale, key)]),
  ) as Record<DiscordLocale, string>;
}
