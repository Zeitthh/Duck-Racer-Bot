import { getAccessory, randomAppearance, type AccessoryDef, type DuckLook } from '@duckbot/core';
import { backgroundFor, renderDuckStrip } from '@duckbot/render';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  escapeMarkdown,
} from 'discord.js';
import { accessoryName, buyCosmetic, ownedAccessories } from '../lib/cosmetics';
import { colorOf, duckChoices, ensureMember, listDucks, lookOf, pickDuck, type DuckWithMember } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import type { Command } from './types';

/** Tiempo que funcionan los botones. */
const BROWSE_MS = 5 * 60_000;
const ID = { prev: 'shop:prev', next: 'shop:next', pos: 'shop:pos', buy: 'shop:buy', equip: 'shop:equip' } as const;
/** Pato de muestra para la vista previa de quien aún no tiene pato. */
const SAMPLE_DUCK = randomAppearance(7);

/**
 * La tienda: un cosmético cada vez, con ◀ ▶ para pasar entre todos los que están a la venta, una vista previa sobre tu
 * pato y los botones Comprar y Ponérselo. Privada: solo la ve quien la abre.
 */
export const shop: Command = {
  data: localizedCommand('shop').addStringOption((o) =>
    localizeOption(o, 'commands.shop.options.duck').setAutocomplete(true),
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
    const guildId = interaction.guildId;

    const items = (await prisma.shopItem.findMany({ where: { guildId, price: { not: null } } }))
      .flatMap((item) => {
        const acc = getAccessory(item.accessoryId);
        return acc ? [{ acc, price: item.price! }] : [];
      })
      .sort((a, b) => accessoryName(a.acc, ctx.locale).localeCompare(accessoryName(b.acc, ctx.locale), ctx.locale));
    if (!items.length)
      return void (await interaction.reply({ content: ctx.t('shop.empty'), flags: MessageFlags.Ephemeral }));

    // La vista previa (y "Ponérselo") es sobre el pato elegido; sin opción, sobre el primero.
    const value = interaction.options.getString('duck');
    let duck: DuckWithMember | null = null;
    if (value) {
      const picked = await pickDuck(prisma, guildId, interaction.user.id, value);
      if (!picked.ok)
        return void (await interaction.reply({ content: ctx.t(picked.error), flags: MessageFlags.Ephemeral }));
      duck = picked.duck;
    } else duck = (await listDucks(prisma, guildId, interaction.user.id))[0] ?? null;
    const member = await ensureMember(prisma, guildId, interaction.user.id);

    let index = 0;
    let status = '';

    const render = async () => {
      const { acc, price } = items[index]!;
      const name = accessoryName(acc, ctx.locale);
      const [owned, fresh] = await Promise.all([
        ownedAccessories(prisma, guildId, member, interaction.member),
        prisma.member.findUniqueOrThrow({ where: { id: member.id } }),
      ]);
      const has = owned.has(acc.id);
      const look: DuckLook = duck
        ? { ...lookOf(duck), accessory: acc, accessoryColor: duck.accessoryId === acc.id ? duck.accessoryColor : null }
        : { appearance: SAMPLE_DUCK, accessory: acc };
      const background = backgroundFor(acc.id);
      const png = renderDuckStrip(look, { scale: 8, background });
      const embed = new EmbedBuilder()
        .setColor(colorOf(background))
        .setTitle(`${ctx.t('shop.title')} · ${name}`)
        .setDescription(
          [
            ctx.t('shop.price', { price }) + (has ? ` · ${ctx.t('shop.owned')}` : ''),
            duck ? ctx.t('shop.previewOn', { duck: escapeMarkdown(duck.name) }) : ctx.t('shop.previewSample'),
          ].join('\n'),
        )
        .setImage('attachment://preview.png')
        .setFooter({ text: ctx.t('shop.balance', { coins: fresh.coins }) });
      const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(ID.prev).setStyle(ButtonStyle.Secondary).setEmoji('◀️'),
        new ButtonBuilder()
          .setCustomId(ID.pos)
          .setStyle(ButtonStyle.Secondary)
          .setLabel(`${index + 1} / ${items.length}`)
          .setDisabled(true),
        new ButtonBuilder().setCustomId(ID.next).setStyle(ButtonStyle.Secondary).setEmoji('▶️'),
      );
      const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(ID.buy)
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛒')
          .setLabel(has ? ctx.t('shop.owned') : ctx.t('shop.buy', { price }))
          .setDisabled(has),
        ...(duck
          ? [
              new ButtonBuilder()
                .setCustomId(ID.equip)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🦆')
                .setLabel(ctx.t('shop.equip'))
                .setDisabled(!has || duck.accessoryId === acc.id),
            ]
          : []),
      );
      return {
        content: status,
        embeds: [embed],
        files: [new AttachmentBuilder(png, { name: 'preview.png' })],
        components: [nav, actions],
      };
    };

    const response = await interaction.reply({
      ...(await render()),
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });
    const message = response.resource?.message;
    if (!message) return;

    const collector = message.createMessageComponentCollector({ time: BROWSE_MS });
    collector.on('collect', async (i) => {
      try {
        const acc: AccessoryDef = items[index]!.acc;
        const name = accessoryName(acc, ctx.locale);
        status = '';
        if (i.customId === ID.prev || i.customId === ID.next) {
          index = (index + (i.customId === ID.next ? 1 : -1) + items.length) % items.length;
        } else if (i.customId === ID.buy) {
          const result = await buyCosmetic(prisma, guildId, member.id, acc.id);
          if (result === 'notForSale') status = ctx.t('buy.notForSale', { name });
          else if (result === 'alreadyOwned') status = ctx.t('buy.alreadyOwned', { name });
          else if ('notEnough' in result) {
            const coins = (await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).coins;
            status = ctx.t('buy.notEnough', { price: result.notEnough, coins });
          } else {
            status = ctx.t('buy.done', { name, price: result.done });
            ctx.logger.info(`${interaction.user.tag} bought ${acc.id} for ${result.done}`);
          }
        } else if (i.customId === ID.equip && duck) {
          // Se vuelve a comprobar que lo tiene (pudo perder el rol que se lo daba) y que el pato sigue siendo suyo.
          const owned = await ownedAccessories(prisma, guildId, member, interaction.member);
          if (!owned.has(acc.id)) status = ctx.t('equip.notOwned', { name });
          else {
            const keep = duck.accessoryId === acc.id ? duck.accessoryColor : null;
            const { count } = await prisma.duck.updateMany({
              where: { id: duck.id, memberId: member.id, strayedAt: null },
              data: { accessoryId: acc.id, accessoryColor: keep },
            });
            if (!count) status = ctx.t('errors.duckNotFound');
            else {
              duck = { ...duck, accessoryId: acc.id, accessoryColor: keep };
              status = ctx.t('equip.done', { duck: escapeMarkdown(duck.name), name });
            }
          }
        }
        // attachments: [] cambia la vista previa anterior por la nueva en vez de sumarla.
        await i.update({ ...(await render()), attachments: [] });
      } catch (e) {
        ctx.logger.error('Shop failed:', e);
      }
    });
    collector.on('end', () => void interaction.editReply({ components: [] }).catch(() => {}));
  },
};
