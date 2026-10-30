import { MAX_PRICE } from '@duckbot/core';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { ensureMember } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import type { Command } from './types';

/** Tiempo para confirmar. Si no contesta, no se envía nada. */
const CONFIRM_MS = 60_000;
const ID = { confirm: 'pay:confirm', cancel: 'pay:cancel' } as const;

/** Enviar PatoCoins a otro miembro, con confirmación. Solo lo ve quien envía; quien recibe lo ve en /saldo. */
export const pay: Command = {
  data: localizedCommand('pay')
    .addUserOption((o) => localizeOption(o, 'commands.pay.options.user').setRequired(true))
    .addIntegerOption((o) =>
      localizeOption(o, 'commands.pay.options.amount').setRequired(true).setMinValue(1).setMaxValue(MAX_PRICE),
    ),

  async execute(interaction, ctx) {
    const { prisma } = ctx;
    const guildId = interaction.guildId;
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (target.id === interaction.user.id) return void (await reply(ctx.t('pay.self')));
    if (target.bot) return void (await reply(ctx.t('pay.bot')));
    const sender = await ensureMember(prisma, guildId, interaction.user.id);
    if (sender.coins < amount) return void (await reply(ctx.t('pay.notEnough', { amount, coins: sender.coins })));

    const user = `<@${target.id}>`;
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ID.confirm).setStyle(ButtonStyle.Success).setLabel(ctx.t('pay.buttonConfirm')),
      new ButtonBuilder().setCustomId(ID.cancel).setStyle(ButtonStyle.Secondary).setLabel(ctx.t('pay.buttonCancel')),
    );
    const response = await interaction.reply({
      content: ctx.t('pay.confirm', { amount, user, coins: sender.coins }),
      components: [buttons],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
      withResponse: true,
    });
    const answer = await response.resource?.message
      ?.awaitMessageComponent({ componentType: ComponentType.Button, time: CONFIRM_MS })
      .catch(() => null);
    const done = (content: string) => ({ content, components: [], allowedMentions: { parse: [] } });
    if (!answer) return void (await interaction.editReply(done(ctx.t('pay.expired'))).catch(() => {}));
    if (answer.customId === ID.cancel) return void (await answer.update(done(ctx.t('pay.cancelled'))));

    // Cobro, abono y los dos movimientos: todo o nada. La condición en el cobro evita gastar más de lo que tiene,
    // aunque haya gastado mientras tanto o haga dos envíos a la vez.
    const receiver = await ensureMember(prisma, guildId, target.id);
    const left = await prisma.$transaction(async (tx) => {
      const paid = await tx.member.updateMany({
        where: { id: sender.id, coins: { gte: amount } },
        data: { coins: { decrement: amount } },
      });
      if (!paid.count) return null;
      await tx.member.update({ where: { id: receiver.id }, data: { coins: { increment: amount } } });
      await tx.coinTransaction.createMany({
        data: [
          { memberId: sender.id, amount: -amount, reason: 'transfer_out', refId: receiver.id },
          { memberId: receiver.id, amount, reason: 'transfer_in', refId: sender.id },
        ],
      });
      return (await tx.member.findUniqueOrThrow({ where: { id: sender.id } })).coins;
    });
    if (left === null) {
      const coins = (await prisma.member.findUniqueOrThrow({ where: { id: sender.id } })).coins;
      return void (await answer.update(done(ctx.t('pay.notEnough', { amount, coins }))));
    }
    await answer.update(done(ctx.t('pay.done', { amount, user, coins: left })));
    ctx.logger.info(`${interaction.user.tag} sent ${amount} PatoCoins to ${target.tag}`);
  },
};
