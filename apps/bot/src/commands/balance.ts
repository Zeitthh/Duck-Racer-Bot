import { levelProgress, progressBar } from '@duckbot/core';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { findMember } from '../lib/ducks';
import { localizedCommand } from '../lib/locale';
import type { Command } from './types';

/** Tu saldo de PatoCoins y tu nivel de jugador. Solo lo ves tú. */
export const balance: Command = {
  data: localizedCommand('balance'),

  async execute(interaction, ctx) {
    const member = await findMember(ctx.prisma, interaction.guildId, interaction.user.id);
    const { level, current, needed } = levelProgress(member?.xp ?? 0);
    const embed = new EmbedBuilder()
      .setColor(0xffd21f)
      .setTitle(ctx.t('balance.title'))
      .setDescription(ctx.t('balance.coins', { coins: member?.coins ?? 0 }))
      .addFields({
        name: ctx.t('balance.level', { level }),
        value: ctx.t('duck.xp', { bar: progressBar(current, needed), current, needed }),
      });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
