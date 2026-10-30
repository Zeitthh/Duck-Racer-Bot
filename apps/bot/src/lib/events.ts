import type { PrismaClient, XpEvent } from '@duckbot/db';

/** Eventos de XP activos ahora en el servidor. */
export const activeEvents = (prisma: PrismaClient, guildId: string, now = new Date()) =>
  prisma.xpEvent.findMany({
    where: { guildId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: 'asc' },
  });

/** Multiplicador para un mensaje: el mayor de los eventos que aplican (los eventos no se acumulan). 1 si no hay. */
export function multiplierFor(events: XpEvent[], channelIds: string[]): number {
  return events
    .filter((e) => e.channelId === null || channelIds.includes(e.channelId))
    .reduce((max, e) => Math.max(max, e.multiplier), 1);
}
