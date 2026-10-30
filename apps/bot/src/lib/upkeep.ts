import { ACCESSORIES, COSMETIC_PRICE } from '@duckbot/core';
import type { PrismaClient } from '@duckbot/db';
import { DiscordAPIError, RESTJSONErrorCodes, type Guild } from 'discord.js';
import type { Logger } from '../logger';
import { OWNED } from './ducks';

/** Guarda el servidor con la zona horaria de .env (TIMEZONE), que es la que usan las carreras y el /diario. */
export const setupGuild = (prisma: PrismaClient, guildId: string, timezone: string) =>
  prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId, timezone }, update: { timezone } });

/**
 * Pone en la tienda, a COSMETIC_PRICE, los cosméticos que el servidor todavía no tiene configurados. Los que ya tienen
 * precio (o se retiraron con /cosmeticos retirar) no se tocan.
 */
export async function stockShop(prisma: PrismaClient, guildId: string, logger: Logger) {
  const known = new Set(
    (await prisma.shopItem.findMany({ where: { guildId }, select: { accessoryId: true } })).map((i) => i.accessoryId),
  );
  const missing = ACCESSORIES.filter((a) => !known.has(a.id));
  if (!missing.length) return;
  await prisma.shopItem.createMany({
    data: missing.map((a) => ({ guildId, accessoryId: a.id, price: COSMETIC_PRICE })),
  });
  logger.info(`Added ${missing.length} cosmetic(s) to the shop at ${COSMETIC_PRICE} PatoCoins.`);
}

/**
 * Los patos de quien ya no está en el servidor se quedan sin dueño: conservan su cosmético, vuelven al nivel 1 y pueden
 * salirle a otra persona al adoptar al azar. Se comprueba preguntando a Discord por cada dueño (no hace falta el
 * intent privilegiado de miembros).
 */
export async function strayDepartedDucks(guild: Guild, prisma: PrismaClient, logger: Logger) {
  const owners = await prisma.member.findMany({
    where: { guildId: guild.id, ducks: { some: OWNED } },
    select: { id: true, discordId: true },
  });
  let strayed = 0;
  for (const owner of owners) {
    const gone = await guild.members.fetch({ user: owner.discordId, force: true }).then(
      () => false,
      // Solo "miembro desconocido" significa que se fue; cualquier otro error (red, límites) no cambia nada.
      (e: unknown) => e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownMember,
    );
    if (!gone) continue;
    const { count } = await prisma.duck.updateMany({
      where: { ...OWNED, memberId: owner.id },
      data: { strayedAt: new Date(), level: 1 },
    });
    strayed += count;
  }
  if (strayed) logger.info(`${strayed} duck(s) in ${guild.name} lost their owner and are waiting for adoption.`);
}

/** Días que se guardan los movimientos de PatoCoins (para revisar errores o abusos recientes). */
const LEDGER_DAYS = 30;

/**
 * Borra los movimientos de PatoCoins de hace más de LEDGER_DAYS días, para que la tabla no crezca sin límite. El saldo
 * no cambia: está guardado en Member.coins.
 */
export async function pruneLedger(prisma: PrismaClient, logger: Logger) {
  const { count } = await prisma.coinTransaction.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - LEDGER_DAYS * 86_400_000) } },
  });
  if (count) logger.info(`Deleted ${count} PatoCoin movement(s) older than ${LEDGER_DAYS} days.`);
}
