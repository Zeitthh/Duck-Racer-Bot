import { MAX_DUCK_LEVEL, trainCost } from '@duckbot/core';
import { MessageFlags, escapeMarkdown } from 'discord.js';
import { duckChoices, pickDuck } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import type { Command } from './types';

/** Sube un nivel a uno de tus patos a cambio de PatoCoins. Solo los propios: pickDuck nunca devuelve el de otra persona. */
export const train: Command = {
  data: localizedCommand('train').addStringOption((o) =>
    localizeOption(o, 'commands.train.options.duck').setAutocomplete(true),
  ),

  async autocomplete(interaction, ctx) {
    const ducks = await duckChoices(
      ctx.prisma,
      interaction.guildId,
      interaction.user.id,
      interaction.options.getFocused(),
    );
    await interaction.respond(ducks.slice(0, 25));
  },

  async execute(interaction, ctx) {
    const { prisma } = ctx;
    const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const picked = await pickDuck(
      prisma,
      interaction.guildId,
      interaction.user.id,
      interaction.options.getString('duck'),
    );
    if (!picked.ok) return void (await reply(ctx.t(picked.error)));
    const duck = picked.duck;
    const name = escapeMarkdown(duck.name);
    if (duck.level >= MAX_DUCK_LEVEL) return void (await reply(ctx.t('train.maxed', { name, max: MAX_DUCK_LEVEL })));

    const price = trainCost(duck.level);
    // Cobro y subida de nivel: todo o nada. Las condiciones en las escrituras evitan cobrar dos veces si se repite el
    // comando a la vez (el nivel tiene que seguir siendo el mismo y el saldo tiene que alcanzar).
    const result = await prisma
      .$transaction(async (tx) => {
        const paid = await tx.member.updateMany({
          where: { id: duck.memberId, coins: { gte: price } },
          data: { coins: { decrement: price } },
        });
        if (!paid.count) return 'notEnough' as const;
        const leveled = await tx.duck.updateMany({
          where: { id: duck.id, memberId: duck.memberId, level: duck.level },
          data: { level: { increment: 1 } },
        });
        if (!leveled.count) throw new Error('changed');
        await tx.coinTransaction.create({
          data: { memberId: duck.memberId, amount: -price, reason: 'train', refId: duck.id },
        });
        return (await tx.member.findUniqueOrThrow({ where: { id: duck.memberId } })).coins;
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === 'changed') return 'changed' as const;
        throw e;
      });

    if (result === 'notEnough')
      return void (await reply(ctx.t('train.notEnough', { name, price, coins: duck.member.coins })));
    if (result === 'changed') return void (await reply(ctx.t('errors.generic')));
    const level = duck.level + 1;
    const next = level < MAX_DUCK_LEVEL ? ctx.t('train.next', { price: trainCost(level) }) : ctx.t('train.nowMax');
    await reply(`${ctx.t('train.done', { name, level, price, coins: result })}\n${next}`);
  },
};
