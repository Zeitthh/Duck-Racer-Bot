import { DAILY_COINS, dayKey, nextMidnight } from '@duckbot/core';
import { MessageFlags } from 'discord.js';
import { ensureMember } from '../lib/ducks';
import { localizedCommand } from '../lib/locale';
import { discordTime, guildTimezone } from '../lib/time';
import type { Command } from './types';

/** Check-in diario: DAILY_COINS PatoCoins una vez por día (el día empieza a medianoche en la zona del servidor). */
export const daily: Command = {
  data: localizedCommand('daily'),

  async execute(interaction, ctx) {
    const { prisma } = ctx;
    const now = new Date();
    const tz = await guildTimezone(prisma, interaction.guildId);
    const today = dayKey(now, tz);
    const member = await ensureMember(prisma, interaction.guildId, interaction.user.id);

    // La condición en la escritura evita cobrar dos veces el mismo día aunque se use el comando dos veces a la vez.
    const coins = await prisma.$transaction(async (tx) => {
      const { count } = await tx.member.updateMany({
        where: { id: member.id, OR: [{ lastDailyKey: null }, { lastDailyKey: { not: today } }] },
        data: { lastDailyKey: today, coins: { increment: DAILY_COINS } },
      });
      if (!count) return null;
      await tx.coinTransaction.create({
        data: { memberId: member.id, amount: DAILY_COINS, reason: 'daily', refId: today },
      });
      return (await tx.member.findUniqueOrThrow({ where: { id: member.id } })).coins;
    });

    const next = discordTime(nextMidnight(now, tz), 'R');
    await interaction.reply({
      content:
        coins === null
          ? ctx.t('daily.already', { next })
          : ctx.t('daily.done', { coins: DAILY_COINS, total: coins, next }),
      flags: MessageFlags.Ephemeral,
    });
  },
};
