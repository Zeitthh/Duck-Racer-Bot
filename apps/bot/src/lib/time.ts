import { DEFAULT_TIMEZONE } from '@duckbot/core';
import type { PrismaClient } from '@duckbot/db';
import type { Locale } from '@duckbot/i18n';

/** Zona horaria del servidor (la de por defecto si todavía no está en la base de datos). */
export async function guildTimezone(prisma: PrismaClient, guildId: string): Promise<string> {
  return (await prisma.guild.findUnique({ where: { id: guildId } }))?.timezone ?? DEFAULT_TIMEZONE;
}

/** Fecha y hora en la zona del servidor, como texto plano (para sitios donde Discord no formatea `<t:…>`). */
export const formatInZone = (date: Date, tz: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(date);

/** Marca de tiempo de Discord: cada usuario la ve en su propia hora local. */
export const discordTime = (date: Date, style: 'f' | 'R' | 't' = 'f') =>
  `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
