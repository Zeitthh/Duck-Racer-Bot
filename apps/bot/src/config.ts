import { DEFAULT_TIMEZONE, isValidTimeZone } from '@duckbot/core';
import { loadRootEnv } from '@duckbot/db';
import { LOCALES } from '@duckbot/i18n';
import { z } from 'zod';
import { LOG_LEVELS } from './logger';

const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord id (numbers only)');

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'is missing'),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_DEV_GUILD_ID: snowflake,
  DEFAULT_LOCALE: z.enum(LOCALES).default('es-419'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /** Canal (por nombre) donde se anuncian las subidas de nivel. Si no existe, se anuncian donde se escribió. */
  LEVEL_UP_CHANNEL: z.string().trim().min(1).default('duckbot'),
  /**
   * Carpeta con el arte: `accessories.json` (los cosméticos) y `catalog/*.duck.json` (los patos del catálogo). Una ruta
   * relativa parte de la raíz del repo. Por defecto, la carpeta `assets/` del repo, que solo trae un ejemplo mínimo.
   */
  ASSETS_DIR: z.string().trim().min(1).default('assets'),
  /** Zona horaria IANA del servidor: a medianoche en esa zona se reinician las carreras y el /diario. */
  TIMEZONE: z
    .string()
    .trim()
    .default(DEFAULT_TIMEZONE)
    .refine(isValidTimeZone, 'must be an IANA time zone, for example America/Mexico_City'),
  /** Rol que reciben quienes adoptan un pato. Si no existe, el bot lo crea. */
  ADOPTER_ROLE: z.string().trim().min(1).max(100).default('Adoptador de patos'),
});

export type Config = z.infer<typeof schema>;

/** Lee y valida las variables de entorno (.env de la raíz). Si falta algo, explica qué y termina el proceso. */
export function loadConfig(): Config {
  loadRootEnv();
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error(`Invalid configuration in .env:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}
