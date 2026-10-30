import {
  DUCK_NAME_MAX,
  MAX_DUCKS,
  STRAY_ADOPT_CHANCE,
  getAccessory,
  parseAppearance,
  randomAppearance,
  randomSeed,
  serializeAppearance,
  validateDuckName,
} from '@duckbot/core';
import type { Appearance } from '@duckbot/core';
import type { SlashCommandStringOption } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, escapeMarkdown } from 'discord.js';
import type { Ctx } from '../context';
import { accessoryName } from '../lib/cosmetics';
import { OWNED, duckCard, ensureMember, listDucks, nameTaken, previewMessage } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import { nameErrorMessage } from '../lib/names';
import { giveAdopterRole } from '../lib/roles';
import type { Command } from './types';

/** Tiempo para decidir. Menor que los 15 min que dura el token de la interacción, para poder avisar que caducó. */
const DECISION_TIME_MS = 10 * 60_000;

const ID = { confirm: 'adopt:confirm', another: 'adopt:another', cancel: 'adopt:cancel' } as const;

/** El pato que se está proponiendo. */
interface Candidate {
  appearance: Appearance;
  /** Lo que se guarda en Duck.origin. */
  origin: string;
  /** Nombre del pato del catálogo, si viene de ahí. */
  catalogName?: string;
  /** Si es un pato sin dueño: cuál, cómo se llamaba y el cosmético que lleva (lo conserva). */
  stray?: { id: string; oldName: string; accessoryId: string | null; accessoryColor: string | null };
}

/**
 * Pato al azar: casi siempre uno nuevo, pero con probabilidad STRAY_ADOPT_CHANCE uno que se quedó sin dueño en este
 * servidor (si hay alguno).
 */
async function randomCandidate(ctx: Ctx, guildId: string): Promise<Candidate> {
  if (Math.random() < STRAY_ADOPT_CHANCE) {
    const strays = await ctx.prisma.duck.findMany({ where: { strayedAt: { not: null }, member: { guildId } } });
    const stray = strays[Math.floor(Math.random() * strays.length)];
    if (stray)
      return {
        appearance: parseAppearance(stray.appearance),
        origin: stray.origin,
        stray: {
          id: stray.id,
          oldName: stray.name,
          accessoryId: stray.accessoryId,
          accessoryColor: stray.accessoryColor,
        },
      };
  }
  const seed = randomSeed();
  return { appearance: randomAppearance(seed), origin: `random:${seed}` };
}

function previewPayload(c: Candidate, name: string, ctx: Ctx) {
  const random = c.catalogName === undefined;
  const accessory = getAccessory(c.stray?.accessoryId);
  const description = c.stray
    ? [
        ctx.t('adopt.previewStray', { old: escapeMarkdown(c.stray.oldName) }),
        ...(accessory ? [ctx.t('adopt.previewStrayCosmetic', { name: accessoryName(accessory, ctx.locale) })] : []),
        ctx.t('adopt.previewRandom'),
      ].join('\n')
    : random
      ? ctx.t('adopt.previewRandom')
      : ctx.t('adopt.previewCatalog', { entry: escapeMarkdown(c.catalogName!) });
  const buttons = [
    new ButtonBuilder().setCustomId(ID.confirm).setStyle(ButtonStyle.Success).setLabel(ctx.t('adopt.buttonAdopt')),
    ...(random
      ? [
          new ButtonBuilder()
            .setCustomId(ID.another)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎲')
            .setLabel(ctx.t('adopt.buttonAnother')),
        ]
      : []),
    new ButtonBuilder().setCustomId(ID.cancel).setStyle(ButtonStyle.Secondary).setLabel(ctx.t('adopt.buttonCancel')),
  ];
  return {
    ...previewMessage(
      { appearance: c.appearance, accessory, accessoryColor: c.stray?.accessoryColor },
      c.stray?.id ?? c.origin,
      ctx.t('adopt.previewTitle', { name: escapeMarkdown(name) }),
      description,
    ),
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
    // Reemplaza la imagen anterior en lugar de añadir otra.
    attachments: [],
  };
}

/** Deja el mensaje solo con un texto (sin imagen ni botones). */
const textOnly = (content: string) => ({ content, embeds: [], components: [], attachments: [] });

export const adopt: Command = {
  data: localizedCommand('adopt')
    .addStringOption((o) =>
      localizeOption(o, 'commands.adopt.options.name').setRequired(true).setMaxLength(DUCK_NAME_MAX),
    )
    .addStringOption((o: SlashCommandStringOption) =>
      localizeOption(o, 'commands.adopt.options.catalog').setAutocomplete(true),
    ),

  async autocomplete(interaction, ctx) {
    const query = interaction.options.getFocused();
    await interaction.respond(ctx.catalog.search(query).map((e) => ({ name: e.name.slice(0, 100), value: e.id })));
  },

  async execute(interaction, ctx) {
    const { prisma } = ctx;
    const ephemeral = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const checked = validateDuckName(interaction.options.getString('name', true));
    if (!checked.ok) return void (await ephemeral(nameErrorMessage(checked.error, ctx)));
    const name = checked.name;

    const owned = await listDucks(prisma, interaction.guildId, interaction.user.id);
    if (owned.length >= MAX_DUCKS) return void (await ephemeral(ctx.t('adopt.limit', { max: MAX_DUCKS })));
    if (nameTaken(owned, name)) return void (await ephemeral(ctx.t('name.duplicate', { name: escapeMarkdown(name) })));

    let candidate: Candidate;
    const catalogId = interaction.options.getString('catalog');
    if (catalogId) {
      const entry = ctx.catalog.get(catalogId);
      if (!entry) return void (await ephemeral(ctx.t('adopt.catalogNotFound')));
      candidate = { appearance: entry.appearance, origin: `catalog:${entry.id}`, catalogName: entry.name };
    } else {
      candidate = await randomCandidate(ctx, interaction.guildId);
    }

    const response = await interaction.reply({
      ...previewPayload(candidate, name, ctx),
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });
    const message = response.resource?.message;
    if (!message) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: DECISION_TIME_MS,
    });

    collector.on('collect', async (button) => {
      try {
        if (button.customId === ID.another) {
          candidate = await randomCandidate(ctx, interaction.guildId);
          await button.update(previewPayload(candidate, name, ctx));
        } else if (button.customId === ID.cancel) {
          collector.stop('cancelled');
          await button.update(textOnly(ctx.t('adopt.cancelled')));
        } else if (button.customId === ID.confirm) {
          collector.stop('adopted');
          const member = await ensureMember(prisma, interaction.guildId, interaction.user.id);
          // Se vuelve a comprobar al guardar: pudo adoptar otro mientras tanto (p. ej. con dos /adoptar abiertos).
          const result = await prisma.$transaction(async (tx) => {
            const ducks = await tx.duck.findMany({ where: { ...OWNED, memberId: member.id } });
            if (ducks.length >= MAX_DUCKS) return 'adopt.limit' as const;
            if (nameTaken(ducks, name)) return 'name.duplicate' as const;
            const stray = candidate.stray;
            if (stray) {
              // Solo si sigue sin dueño: otra persona pudo adoptarlo mientras tanto. Empieza en el nivel 1.
              const { count } = await tx.duck.updateMany({
                where: { id: stray.id, strayedAt: { not: null } },
                data: { memberId: member.id, name, level: 1, strayedAt: null },
              });
              if (!count) return 'adopt.strayTaken' as const;
              // Su cosmético pasa a ser del nuevo dueño, para que pueda volver a ponérselo si se lo quita.
              if (stray.accessoryId)
                await tx.inventoryItem.upsert({
                  where: { memberId_accessoryId: { memberId: member.id, accessoryId: stray.accessoryId } },
                  create: { memberId: member.id, accessoryId: stray.accessoryId, source: 'grant' },
                  update: {},
                });
              return tx.duck.findUniqueOrThrow({ where: { id: stray.id }, include: { member: true } });
            }
            return tx.duck.create({
              data: {
                memberId: member.id,
                name,
                appearance: serializeAppearance(candidate.appearance),
                origin: candidate.origin,
              },
              include: { member: true },
            });
          });
          if (typeof result === 'string')
            return void (await button.update(textOnly(ctx.t(result, { max: MAX_DUCKS, name: escapeMarkdown(name) }))));
          const duck = result;
          // La vista previa privada se cambia por la tarjeta del pato: solo la ve quien adoptó.
          await button.update({
            ...textOnly(ctx.t('adopt.adoptedPrivate', { name: escapeMarkdown(name) })),
            ...duckCard(duck, ctx),
          });
          await giveAdopterRole(interaction.member, ctx.config.ADOPTER_ROLE, ctx.logger);
          ctx.logger.info(
            `${interaction.user.tag} adopted "${name}" (${candidate.stray ? `stray ${candidate.stray.id}` : candidate.origin})`,
          );
        }
      } catch (e) {
        ctx.logger.error('Adoption failed:', e);
        await button.followUp({ content: ctx.t('errors.generic'), flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') await interaction.editReply(textOnly(ctx.t('adopt.expired'))).catch(() => {});
    });
  },
};
