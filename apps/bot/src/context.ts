import type { PrismaClient } from '@duckbot/db';
import { t, type Locale, type MessageKey } from '@duckbot/i18n';
import type { Catalog } from './catalog';
import type { Config } from './config';
import type { Logger } from './logger';

/** Lo que comparte todo el bot. */
export interface AppContext {
  config: Config;
  logger: Logger;
  prisma: PrismaClient;
  catalog: Catalog;
}

/** El contexto de una interacción: el de la app más el idioma del usuario. */
export interface Ctx extends AppContext {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

export const withLocale = (app: AppContext, locale: Locale): Ctx => ({
  ...app,
  locale,
  t: (key, vars) => t(locale, key, vars),
});
