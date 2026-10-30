import { MAX_PRICE } from '@duckbot/core';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { ensureMember } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import type { Command } from './types';

const S = 'commands.coins.subcommands' as const;

/** Dar o quitar PatoCoins a mano. Mismo acceso por defecto que /cosmetics (se cambia en Integraciones). */
export const coins: Command = {
  data: localizedCommand('coins')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      localizeOption(s, `${S}.give`)
        .addUserOption((o) => localizeOption(o, `${S}.give.options.user`).setRequired(true))
        .addIntegerOption((o) =>
          localizeOption(o, `${S}.give.options.amount`).setRequired(true).setMinValue(1).setMaxValue(MAX_PRICE),
        ),
    )
    .addSubcommand((s) =>
      localizeOption(s, `${S}.take`)
        .addUserOption((o) => localizeOption(o, `${S}.take.options.user`).setRequired(true))
        .addIntegerOption((o) =>
          localizeOption(o, `${S}.take.options.amount`).setRequired(true).setMinValue(1).setMaxValue(MAX_PRICE),
        ),
    ),

  async execute(interaction, ctx) {
    const { prisma } = ctx;
    const user = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const change = interaction.options.getSubcommand() === 'take' ? -amount : amount;
    const member = await ensureMember(prisma, interaction.guildId, user.id);
    // El saldo nunca baja de 0: se registra lo que de verdad cambió.
    const result = await prisma.$transaction(async (tx) => {
      const current = (await tx.member.findUniqueOrThrow({ where: { id: member.id } })).coins;
      const next = Math.max(0, current + change);
      if (next !== current) {
        await tx.member.update({ where: { id: member.id }, data: { coins: next } });
        await tx.coinTransaction.create({
          data: { memberId: member.id, amount: next - current, reason: 'admin', refId: interaction.user.id },
        });
      }
      return { next, diff: next - current };
    });
    const diff = result.diff >= 0 ? `+${result.diff}` : String(result.diff);
    await interaction.reply({
      content: ctx.t('manage.coinsSet', { user: `<@${user.id}>`, coins: result.next, diff }),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
