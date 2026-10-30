import { ACCESSORIES, type AccessoryDef } from '@duckbot/core';
import { isUniqueViolation, type Member, type PrismaClient } from '@duckbot/db';
import type { Locale } from '@duckbot/i18n';
import type { GuildMember } from 'discord.js';

export const accessoryName = (acc: AccessoryDef, locale: Locale) => acc.names[locale];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sugerencias de autocompletado: accesorios cuyo nombre (en el idioma del usuario o en inglés) contiene el texto. */
export function accessoryChoices(query: string, locale: Locale, only?: (acc: AccessoryDef) => boolean) {
  const q = fold(query.trim());
  return ACCESSORIES.filter((a) => !only || only(a))
    .filter((a) => fold(a.names[locale]).includes(q) || fold(a.names['en-US']).includes(q) || a.id.includes(q))
    .slice(0, 25)
    .map((a) => ({ name: a.names[locale], value: a.id }));
}

export type OwnedSource = { kind: 'shop' | 'grant' } | { kind: 'role'; roleId: string };

/**
 * Cosméticos que tiene un miembro: los de su inventario (comprados o regalados) y los que da algún rol que tiene.
 * Si un cosmético viene de las dos formas, cuenta el del inventario.
 */
export async function ownedAccessories(
  prisma: PrismaClient,
  guildId: string,
  member: Member | null,
  discordMember: GuildMember,
): Promise<Map<string, OwnedSource>> {
  const owned = new Map<string, OwnedSource>();
  const [inventory, roleItems] = await Promise.all([
    member ? prisma.inventoryItem.findMany({ where: { memberId: member.id } }) : [],
    prisma.shopItem.findMany({ where: { guildId, roleId: { not: null } } }),
  ]);
  for (const item of roleItems)
    if (item.roleId && discordMember.roles.cache.has(item.roleId))
      owned.set(item.accessoryId, { kind: 'role', roleId: item.roleId });
  for (const item of inventory) owned.set(item.accessoryId, { kind: item.source === 'shop' ? 'shop' : 'grant' });
  return owned;
}

export type BuyResult = 'notForSale' | 'alreadyOwned' | { notEnough: number } | { done: number };

/**
 * Compra un cosmético de la tienda. Precio, saldo, inventario y registro de la transacción cambian juntos o no cambia
 * nada; si el saldo no alcanza, no se cobra.
 */
export function buyCosmetic(prisma: PrismaClient, guildId: string, memberId: string, accessoryId: string) {
  return (
    prisma
      .$transaction(async (tx): Promise<BuyResult> => {
        const item = await tx.shopItem.findUnique({ where: { guildId_accessoryId: { guildId, accessoryId } } });
        if (item?.price == null) return 'notForSale';
        const price = item.price;
        const paid = await tx.member.updateMany({
          where: { id: memberId, coins: { gte: price } },
          data: { coins: { decrement: price } },
        });
        if (paid.count === 0) return { notEnough: price };
        await tx.inventoryItem.create({ data: { memberId, accessoryId, source: 'shop' } });
        await tx.coinTransaction.create({ data: { memberId, amount: -price, reason: 'shop', refId: accessoryId } });
        return { done: price };
      })
      // Dos compras a la vez: la segunda choca con el inventario único y no cobra nada.
      .catch((e: unknown): BuyResult => {
        if (isUniqueViolation(e)) return 'alreadyOwned';
        throw e;
      })
  );
}
