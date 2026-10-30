import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, escapeMarkdown } from 'discord.js';
import { releaseRefund } from '@duckbot/core';
import { OWNED, duckCard, duckChoices, pickDuck } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import { removeAdopterRole } from '../lib/roles';
import type { Command } from './types';

/** Tiempo para confirmar. Si no contesta, el pato se queda. */
const CONFIRM_MS = 60_000;
const ID = { confirm: 'release:confirm', cancel: 'release:cancel' } as const;
const textOnly = (content: string) => ({ content, embeds: [], components: [], attachments: [] });

/** Liberar uno de tus patos. Solo los propios: pickDuck nunca devuelve el pato de otra persona. */
export const release: Command = {
  data: localizedCommand('release').addStringOption((o) =>
    localizeOption(o, 'commands.release.options.duck').setRequired(true).setAutocomplete(true),
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
    const picked = await pickDuck(
      prisma,
      interaction.guildId,
      interaction.user.id,
      interaction.options.getString('duck', true),
    );
    if (!picked.ok)
      return void (await interaction.reply({ content: ctx.t(picked.error), flags: MessageFlags.Ephemeral }));
    const duck = picked.duck;
    const name = escapeMarkdown(duck.name);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ID.confirm).setStyle(ButtonStyle.Danger).setLabel(ctx.t('release.buttonConfirm')),
      new ButtonBuilder()
        .setCustomId(ID.cancel)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(ctx.t('release.buttonCancel')),
    );
    const response = await interaction.reply({
      ...duckCard(duck, ctx),
      content: ctx.t('release.confirm', { name, level: duck.level, refund: releaseRefund(duck.level) }),
      components: [buttons],
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });
    const answer = await response.resource?.message
      ?.awaitMessageComponent({ componentType: ComponentType.Button, time: CONFIRM_MS })
      .catch(() => null);
    if (!answer)
      return void (await interaction.editReply(textOnly(ctx.t('release.expired', { name }))).catch(() => {}));
    if (answer.customId === ID.cancel)
      return void (await answer.update(textOnly(ctx.t('release.cancelled', { name }))));

    // Un pato apuntado a una carrera que aún no sale no se puede liberar: dejaría su carril vacío.
    const racing = await prisma.raceEntry.count({ where: { duckId: duck.id, race: { status: 'OPEN' } } });
    if (racing) return void (await answer.update(textOnly(ctx.t('release.inRace', { name }))));

    // Se borra solo si sigue siendo suyo (memberId) y no ha cambiado de nivel: no se puede liberar el pato de otra
    // persona, y la devolución corresponde al nivel que tenía. Borrado y devolución: todo o nada.
    const refund = releaseRefund(duck.level);
    const released = await prisma.$transaction(async (tx) => {
      const { count } = await tx.duck.deleteMany({
        where: { ...OWNED, id: duck.id, memberId: duck.memberId, level: duck.level },
      });
      if (!count) return false;
      if (refund) {
        await tx.member.update({ where: { id: duck.memberId }, data: { coins: { increment: refund } } });
        await tx.coinTransaction.create({
          data: { memberId: duck.memberId, amount: refund, reason: 'release_refund', refId: duck.id },
        });
      }
      return true;
    });
    if (!released) return void (await answer.update(textOnly(ctx.t('errors.duckNotFound'))));
    const refunded = refund ? `\n${ctx.t('release.refund', { coins: refund })}` : '';
    await answer.update(textOnly(ctx.t('release.done', { name }) + refunded));
    ctx.logger.info(`${interaction.user.tag} released "${duck.name}" (refund ${refund})`);

    if (!(await prisma.duck.count({ where: { ...OWNED, memberId: duck.memberId } })))
      await removeAdopterRole(interaction.member, ctx.config.ADOPTER_ROLE, ctx.logger);
  },
};
