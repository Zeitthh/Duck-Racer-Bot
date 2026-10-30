import { MessageFlags } from 'discord.js';
import { localizedCommand } from '../lib/locale';
import type { Command } from './types';

export const ping: Command = {
  data: localizedCommand('ping'),
  async execute(interaction, ctx) {
    await interaction.reply({
      content: ctx.t('ping.reply', { ms: Math.max(0, interaction.client.ws.ping) }),
      flags: MessageFlags.Ephemeral,
    });
  },
};
