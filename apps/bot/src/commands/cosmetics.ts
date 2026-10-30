import { MAX_PRICE, getAccessory } from '@duckbot/core';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { accessoryChoices, accessoryName } from '../lib/cosmetics';
import { ensureGuild, ensureMember, findMember } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import type { Command } from './types';

const S = 'commands.cosmetics.subcommands' as const;

/**
 * Gestión de la tienda y de los cosméticos de los miembros. Por defecto solo lo ve quien puede gestionar el
 * servidor; se le puede dar a otros roles en Ajustes del servidor → Integraciones → DuckBot.
 */
export const cosmetics: Command = {
  data: localizedCommand('cosmetics')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      localizeOption(s, `${S}.price`)
        .addStringOption((o) =>
          localizeOption(o, `${S}.price.options.accessory`).setRequired(true).setAutocomplete(true),
        )
        // Sin precio, el cosmético se retira de la tienda.
        .addIntegerOption((o) => localizeOption(o, `${S}.price.options.price`).setMinValue(0).setMaxValue(MAX_PRICE)),
    )
    .addSubcommand((s) =>
      localizeOption(s, `${S}.give`)
        .addUserOption((o) => localizeOption(o, `${S}.give.options.user`).setRequired(true))
        .addStringOption((o) =>
          localizeOption(o, `${S}.give.options.accessory`).setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      localizeOption(s, `${S}.take`)
        .addUserOption((o) => localizeOption(o, `${S}.take.options.user`).setRequired(true))
        .addStringOption((o) =>
          localizeOption(o, `${S}.take.options.accessory`).setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      localizeOption(s, `${S}.role`)
        .addStringOption((o) =>
          localizeOption(o, `${S}.role.options.accessory`).setRequired(true).setAutocomplete(true),
        )
        .addRoleOption((o) => localizeOption(o, `${S}.role.options.role`)),
    ),

  async autocomplete(interaction, ctx) {
    await interaction.respond(accessoryChoices(interaction.options.getFocused(), ctx.locale));
  },

  async execute(interaction, ctx) {
    const { prisma } = ctx;
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    const acc = getAccessory(interaction.options.getString('accessory', true));
    if (!acc) return void (await reply(ctx.t('errors.unknownAccessory')));
    const name = accessoryName(acc, ctx.locale);
    const itemKey = { guildId_accessoryId: { guildId, accessoryId: acc.id } };
    await ensureGuild(prisma, guildId);

    switch (sub) {
      case 'price': {
        const price = interaction.options.getInteger('price');
        await prisma.shopItem.upsert({
          where: itemKey,
          create: { guildId, accessoryId: acc.id, price },
          update: { price },
        });
        return void (await reply(
          price === null ? ctx.t('manage.unlisted', { name }) : ctx.t('manage.priceSet', { name, price }),
        ));
      }
      case 'give': {
        const user = interaction.options.getUser('user', true);
        const member = await ensureMember(prisma, guildId, user.id);
        const exists = await prisma.inventoryItem.findUnique({
          where: { memberId_accessoryId: { memberId: member.id, accessoryId: acc.id } },
        });
        if (exists) return void (await reply(ctx.t('manage.alreadyHas', { user: `<@${user.id}>`, name })));
        await prisma.inventoryItem.create({ data: { memberId: member.id, accessoryId: acc.id, source: 'grant' } });
        return void (await reply(ctx.t('manage.given', { user: `<@${user.id}>`, name })));
      }
      case 'take': {
        const user = interaction.options.getUser('user', true);
        const member = await findMember(prisma, guildId, user.id);
        const { count } = member
          ? await prisma.inventoryItem.deleteMany({ where: { memberId: member.id, accessoryId: acc.id } })
          : { count: 0 };
        if (!count) return void (await reply(ctx.t('manage.didntHave', { user: `<@${user.id}>`, name })));
        await prisma.duck.updateMany({
          where: { memberId: member!.id, accessoryId: acc.id },
          data: { accessoryId: null, accessoryColor: null },
        });
        return void (await reply(ctx.t('manage.taken', { user: `<@${user.id}>`, name })));
      }
      case 'role': {
        const role = interaction.options.getRole('role');
        await prisma.shopItem.upsert({
          where: itemKey,
          create: { guildId, accessoryId: acc.id, roleId: role?.id ?? null },
          update: { roleId: role?.id ?? null },
        });
        return void (await reply(
          role ? ctx.t('manage.roleSet', { role: `<@&${role.id}>`, name }) : ctx.t('manage.roleCleared', { name }),
        ));
      }
    }
  },
};
