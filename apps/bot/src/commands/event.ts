import { XP_EVENT_MAX_HOURS, XP_EVENT_MULTIPLIERS } from '@duckbot/core';
import { ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { Ctx } from '../context';
import { ensureGuild } from '../lib/ducks';
import { activeEvents } from '../lib/events';
import { localizeOption, localizedCommand } from '../lib/locale';
import { discordTime as ts, formatInZone, guildTimezone } from '../lib/time';
import type { Command } from './types';

const where = (channelId: string | null, ctx: Ctx) =>
  channelId ? ctx.t('event.inChannel', { channel: `<#${channelId}>` }) : ctx.t('event.everywhere');

export const event: Command = {
  data: localizedCommand('event')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      localizeOption(s, 'commands.event.subcommands.start')
        .addNumberOption((o) =>
          localizeOption(o, 'commands.event.subcommands.start.options.multiplier')
            .setRequired(true)
            .addChoices(XP_EVENT_MULTIPLIERS.map((m) => ({ name: `×${m}`, value: m }))),
        )
        .addIntegerOption((o) =>
          localizeOption(o, 'commands.event.subcommands.start.options.hours')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(XP_EVENT_MAX_HOURS),
        )
        .addChannelOption((o) =>
          localizeOption(o, 'commands.event.subcommands.start.options.channel').addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildVoice,
            ChannelType.GuildForum,
          ),
        ),
    )
    .addSubcommand((s) =>
      localizeOption(s, 'commands.event.subcommands.end').addStringOption((o) =>
        localizeOption(o, 'commands.event.subcommands.end.options.event').setRequired(true).setAutocomplete(true),
      ),
    ),

  async autocomplete(interaction, ctx) {
    const [events, tz] = await Promise.all([
      activeEvents(ctx.prisma, interaction.guildId),
      guildTimezone(ctx.prisma, interaction.guildId),
    ]);
    // El autocompletado no admite marcas <t:…>: la hora va en la zona del servidor.
    const choices = events.map((e) => {
      const channel = e.channelId ? `#${interaction.guild.channels.cache.get(e.channelId)?.name ?? e.channelId}` : '*';
      const end = formatInZone(e.endsAt, tz, ctx.locale);
      return { name: `×${e.multiplier} · ${channel} · → ${end}`.slice(0, 100), value: e.id };
    });
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction, ctx) {
    const { prisma } = ctx;
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const multiplier = interaction.options.getNumber('multiplier', true);
      const hours = interaction.options.getInteger('hours', true);
      const channelId = interaction.options.getChannel('channel')?.id ?? null;
      await ensureGuild(prisma, interaction.guildId);
      const created = await prisma.xpEvent.create({
        data: {
          guildId: interaction.guildId,
          channelId,
          multiplier,
          endsAt: new Date(Date.now() + hours * 3_600_000),
          createdById: interaction.user.id,
        },
      });
      await interaction.reply({
        content: ctx.t('event.started', { multiplier, where: where(channelId, ctx), end: ts(created.endsAt) }),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    // end (el autocompletado ya enseña los eventos activos, por eso no hay subcomando para listarlos)
    const id = interaction.options.getString('event', true);
    const { count } = await prisma.xpEvent.updateMany({
      where: { id, guildId: interaction.guildId, endsAt: { gt: new Date() } },
      data: { endsAt: new Date() },
    });
    await interaction.reply({
      content: count ? ctx.t('event.ended') : ctx.t('event.notFound'),
      flags: MessageFlags.Ephemeral,
    });
  },
};
