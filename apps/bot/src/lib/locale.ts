import {
  FALLBACK_LOCALE,
  discordLocalizations,
  resolveLocale,
  t,
  type Locale,
  type MessageKey,
  type Messages,
} from '@duckbot/i18n';
import { InteractionContextType, SlashCommandBuilder, type LocalizationMap } from 'discord.js';

/** Idioma de la respuesta: el del usuario, luego el del servidor y, al final, el de .env. */
export const localeOf = (i: { locale: string; guildLocale: string | null }, fallback: Locale): Locale =>
  resolveLocale(i.locale) ?? resolveLocale(i.guildLocale) ?? fallback;

const localizations = (key: MessageKey) => discordLocalizations(key) as LocalizationMap;

type CommandId = keyof Messages['commands'];

/** Comando con nombre y descripción en inglés por defecto y traducidos para cada idioma de Discord. Solo en servidores. */
export function localizedCommand(id: CommandId): SlashCommandBuilder {
  const name = `commands.${id}.name` as const;
  const description = `commands.${id}.description` as const;
  return new SlashCommandBuilder()
    .setName(t(FALLBACK_LOCALE, name))
    .setNameLocalizations(localizations(name))
    .setDescription(t(FALLBACK_LOCALE, description))
    .setDescriptionLocalizations(localizations(description))
    .setContexts(InteractionContextType.Guild);
}

/**
 * "commands.adopt.options.name", "commands.cosmetics.subcommands.price", etc.: la parte común de las claves `.name` y
 * `.description` de una opción o un subcomando.
 */
type OptionKey = MessageKey extends infer K
  ? K extends `${infer Base}.name`
    ? Base extends `commands.${string}.${'options' | 'subcommands'}.${string}`
      ? Base
      : never
    : never
  : never;

/** Cualquier constructor de discord.js con nombre y descripción traducibles (opciones y subcomandos). */
interface Localizable {
  setName(name: string): unknown;
  setNameLocalizations(localizations: LocalizationMap): unknown;
  setDescription(description: string): unknown;
  setDescriptionLocalizations(localizations: LocalizationMap): unknown;
}

/**
 * Pone nombre y descripción traducidos a una opción o a un subcomando. El nombre base (inglés) es el que se lee en el
 * código (`getString('name')`, `getSubcommand() === 'price'`).
 */
export function localizeOption<T extends Localizable>(option: T, key: OptionKey): T {
  option.setName(t(FALLBACK_LOCALE, `${key}.name`));
  option.setNameLocalizations(localizations(`${key}.name`));
  option.setDescription(t(FALLBACK_LOCALE, `${key}.description`));
  option.setDescriptionLocalizations(localizations(`${key}.description`));
  return option;
}

/** Opción fija (`addChoices`) con su nombre traducido. */
export const localizedChoice = <V extends string | number>(key: MessageKey, value: V) => ({
  name: t(FALLBACK_LOCALE, key),
  name_localizations: localizations(key),
  value,
});
