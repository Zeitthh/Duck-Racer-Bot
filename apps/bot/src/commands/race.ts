import {
  RACES_PER_DAY,
  RACE_LOBBY_MS,
  RACE_MAX_DUCKS,
  dayKey,
  mulberry32,
  nextMidnight,
  racePrize,
  randomAppearance,
  randomSeed,
  simulateRace,
  type DuckLook,
} from '@duckbot/core';
import { isUniqueViolation } from '@duckbot/db';
import { renderRaceGif } from '@duckbot/render';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  escapeMarkdown,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { withLocale, type Ctx } from '../context';
import { duckChoices, listDucks, lookOf, pickDuck, type DuckWithMember } from '../lib/ducks';
import { localeOf, localizeOption, localizedCommand } from '../lib/locale';
import { discordTime, guildTimezone } from '../lib/time';
import type { Command } from './types';

const ID = { join: 'race:join', start: 'race:start', cancel: 'race:cancel', pick: 'race:pick' } as const;
const MEDALS = ['🥇', '🥈', '🥉'];

interface Racer {
  discordId: string;
  duckName: string;
}

export const race: Command = {
  data: localizedCommand('race').addStringOption((o) =>
    localizeOption(o, 'commands.race.options.duck').setAutocomplete(true),
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
    const ephemeral = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const picked = await pickDuck(prisma, guildId, interaction.user.id, interaction.options.getString('duck'));
    if (!picked.ok)
      return void (await ephemeral(ctx.t(picked.error === 'errors.noDuck' ? 'race.noDuck' : picked.error)));
    const duck = picked.duck;

    if (await prisma.race.findFirst({ where: { guildId, status: 'OPEN' } }))
      return void (await ephemeral(ctx.t('race.alreadyOpen')));

    const now = new Date();
    const tz = await guildTimezone(prisma, guildId);
    const today = dayKey(now, tz);
    const used = await prisma.race.count({ where: { guildId, dayKey: today, status: { not: 'CANCELLED' } } });
    if (used >= RACES_PER_DAY)
      return void (await ephemeral(
        ctx.t('race.dailyLimit', { max: RACES_PER_DAY, time: discordTime(nextMidnight(now, tz), 'R') }),
      ));

    const raceRow = await prisma.race.create({
      data: {
        guildId,
        dayKey: today,
        seed: randomSeed(),
        createdById: interaction.user.id,
        entries: { create: { memberId: duck.memberId, duckId: duck.id, lane: 0 } },
      },
    });
    const racers: Racer[] = [{ discordId: interaction.user.id, duckName: duck.name }];
    const startsAt = new Date(now.getTime() + RACE_LOBBY_MS);
    const left = RACES_PER_DAY - used - 1;

    const lobby = () => {
      const embed = new EmbedBuilder()
        .setColor(0x3aa655)
        .setTitle(ctx.t('race.lobbyTitle'))
        .setDescription(
          [
            ctx.t('race.lobbyBody', { time: discordTime(startsAt, 'R'), user: `<@${interaction.user.id}>` }),
            ctx.t('race.prizes', {
              first: racePrize(1, racers.length),
              second: racePrize(2, racers.length),
              third: racePrize(3, racers.length),
              rest: racePrize(4, racers.length),
            }),
            ctx.t('race.morePlayers'),
            ctx.t('race.remaining', { left, max: RACES_PER_DAY }),
          ].join('\n\n'),
        )
        .addFields({
          name: ctx.t('race.participants', { count: racers.length, max: RACE_MAX_DUCKS }),
          value: [
            ...racers.map((r, i) => `${i + 1}. **${escapeMarkdown(r.duckName)}** (<@${r.discordId}>)`),
            ...(racers.length < RACE_MAX_DUCKS
              ? [ctx.t('race.botFill', { count: RACE_MAX_DUCKS - racers.length })]
              : []),
          ].join('\n'),
        });
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(ID.join)
          .setStyle(ButtonStyle.Success)
          .setEmoji('🦆')
          .setLabel(ctx.t('race.buttonJoin')),
        new ButtonBuilder().setCustomId(ID.start).setStyle(ButtonStyle.Primary).setLabel(ctx.t('race.buttonStart')),
        new ButtonBuilder().setCustomId(ID.cancel).setStyle(ButtonStyle.Secondary).setLabel(ctx.t('race.buttonCancel')),
      );
      return { embeds: [embed], components: [buttons], allowedMentions: { parse: [] } };
    };

    const response = await interaction.reply({ ...lobby(), withResponse: true });
    const message = response.resource?.message;
    if (!message) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: RACE_LOBBY_MS,
    });

    collector.on('collect', async (button) => {
      // Cada botón responde en el idioma de quien lo pulsa.
      const bctx = withLocale(ctx, localeOf(button, ctx.config.DEFAULT_LOCALE));
      const privately = (content: string) =>
        button.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      try {
        if (button.customId === ID.join) {
          if (racers.some((r) => r.discordId === button.user.id))
            return void (await privately(bctx.t('race.alreadyJoined')));
          if (racers.length >= RACE_MAX_DUCKS) return void (await privately(bctx.t('race.full')));
          const ducks = await listDucks(prisma, guildId, button.user.id);
          if (!ducks.length) return void (await privately(bctx.t('race.noDuck')));

          /** Lo apunta y actualiza el lobby. Devuelve el texto para quien se unió, o null si ya se unió. */
          const join = async (joiner: DuckWithMember) => {
            if (collector.ended) return bctx.t('race.closed');
            if (racers.length >= RACE_MAX_DUCKS) return bctx.t('race.full');
            try {
              await prisma.raceEntry.create({
                data: { raceId: raceRow.id, memberId: joiner.memberId, duckId: joiner.id, lane: racers.length },
              });
            } catch (e) {
              if (isUniqueViolation(e)) return bctx.t('race.alreadyJoined');
              throw e;
            }
            racers.push({ discordId: button.user.id, duckName: joiner.name });
            return null;
          };

          if (ducks.length === 1) {
            const error = await join(ducks[0]!);
            if (error) return void (await privately(error));
            await button.update(lobby());
            return;
          }

          // Con varios patos, elige cuál en un menú que solo ve quien pulsó.
          const menu = new StringSelectMenuBuilder()
            .setCustomId(ID.pick)
            .setPlaceholder(bctx.t('race.chooseDuck'))
            .addOptions(ducks.map((d) => ({ label: d.name, value: d.id })));
          const asked = await button.reply({
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
            flags: MessageFlags.Ephemeral,
            withResponse: true,
          });
          const pick = await asked.resource?.message
            ?.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: RACE_LOBBY_MS })
            .catch(() => null);
          if (!pick) return void (await button.editReply({ content: bctx.t('race.closed'), components: [] }));
          const chosen = ducks.find((d) => d.id === pick.values[0]);
          const error = chosen ? await join(chosen) : bctx.t('errors.duckNotFound');
          await pick.update({
            content: error ?? bctx.t('race.joined', { duck: escapeMarkdown(chosen!.name) }),
            components: [],
          });
          if (!error) await interaction.editReply(lobby());
          return;
        }

        if (button.user.id !== interaction.user.id)
          return void (await privately(bctx.t('race.onlyCreator', { user: `<@${interaction.user.id}>` })));
        if (button.customId === ID.cancel) {
          collector.stop('cancel');
          await button.deferUpdate();
        } else if (button.customId === ID.start) {
          collector.stop('start');
          await button.deferUpdate();
        }
      } catch (e) {
        ctx.logger.error('Race button failed:', e);
        await privately(bctx.t('errors.generic')).catch(() => {});
      }
    });

    collector.on('end', async (_collected, reason) => {
      try {
        // Si se acaba el tiempo sin que nadie más se una, sale igual: el bot rellena los carriles.
        if (reason === 'cancel') {
          await prisma.race.update({ where: { id: raceRow.id }, data: { status: 'CANCELLED' } });
          await interaction.editReply({ content: ctx.t('race.cancelled'), embeds: [], components: [] });
          return;
        }
        await runRace(interaction, ctx, raceRow.id, raceRow.seed);
      } catch (e) {
        ctx.logger.error('Race failed:', e);
        await prisma.race.update({ where: { id: raceRow.id }, data: { status: 'CANCELLED' } }).catch(() => {});
        await interaction.editReply({ content: ctx.t('errors.generic'), embeds: [], components: [] }).catch(() => {});
      }
    });
  },
};

/** Simula la carrera, reparte los premios y cambia el mensaje del lobby por el GIF y los resultados. */
async function runRace(interaction: ChatInputCommandInteraction<'cached'>, ctx: Ctx, raceId: string, seed: number) {
  const { prisma } = ctx;
  await interaction.editReply({ content: ctx.t('race.running'), components: [] });

  // /liberar no deja liberar un pato apuntado a una carrera abierta; aun así, si faltara, esa entrada no corre.
  const entries = (
    await prisma.raceEntry.findMany({
      where: { raceId },
      include: { duck: true, member: true },
      orderBy: { lane: 'asc' },
    })
  ).flatMap((e) => (e.duck ? [{ ...e, duck: e.duck }] : []));
  const players = entries.length;
  if (!players) throw new Error(`Race ${raceId} has no ducks left`);
  // Cuenta el nivel de cada pato (el que se entrena con PatoCoins), no el del jugador.
  const levels = entries.map((e) => e.duck.level);
  // Los patos del bot corren al nivel medio de los jugadores: ni regalan la carrera ni la hacen imposible.
  const botLevel = Math.round(levels.reduce((a, b) => a + b, 0) / players);
  const bots = botRacers(ctx, RACE_MAX_DUCKS - players, seed);
  const result = simulateRace(
    [...levels, ...bots.map(() => botLevel)].map((level) => ({ level })),
    seed,
  );
  const gif = renderRaceGif([...entries.map((e) => lookOf(e.duck)), ...bots.map((b) => b.look)], result);

  // Puestos, premios, saldos y registro de transacciones: todo o nada. Los patos del bot no cobran.
  await prisma.$transaction(async (tx) => {
    for (const [i, lane] of result.order.entries()) {
      const entry = entries[lane];
      if (!entry) continue;
      const position = i + 1;
      const prize = racePrize(position, players);
      await tx.raceEntry.update({ where: { id: entry.id }, data: { position, prize, level: levels[lane] } });
      await tx.member.update({ where: { id: entry.memberId }, data: { coins: { increment: prize } } });
      await tx.coinTransaction.create({
        data: { memberId: entry.memberId, amount: prize, reason: 'race_prize', refId: raceId },
      });
    }
    await tx.race.update({ where: { id: raceId }, data: { status: 'FINISHED', finishedAt: new Date() } });
  });

  const lines = result.order.map((lane, i) => {
    const medal = MEDALS[i] ?? `${i + 1}.`;
    const entry = entries[lane];
    if (!entry)
      return ctx.t('race.resultLineBot', { medal, duck: escapeMarkdown(bots[lane - players]!.name), lane: lane + 1 });
    return ctx.t('race.resultLine', {
      medal,
      duck: escapeMarkdown(entry.duck.name),
      user: `<@${entry.member.discordId}>`,
      lane: lane + 1,
      prize: racePrize(i + 1, players),
    });
  });
  const embed = new EmbedBuilder()
    .setColor(0xffd21f)
    .setTitle(ctx.t('race.resultsTitle'))
    .setDescription(lines.join('\n'))
    .setImage('attachment://race.gif');
  await interaction.editReply({
    content: '',
    embeds: [embed],
    files: [new AttachmentBuilder(gif, { name: 'race.gif' })],
    components: [],
    allowedMentions: { parse: [] },
  });
  ctx.logger.info(`Race ${raceId} finished with ${players} players and ${bots.length} bot ducks`);
}

/**
 * Patos del bot para los carriles libres: aves del catálogo sin repetir (o patos aleatorios si no hay catálogo).
 * Salen de la semilla de la carrera, así que la misma carrera siempre tiene los mismos rivales.
 */
function botRacers(ctx: Ctx, count: number, seed: number): { name: string; look: DuckLook }[] {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const pool = [...ctx.catalog.entries];
  return Array.from({ length: count }, (_, i) => {
    if (!pool.length)
      return {
        name: ctx.t('race.botName', { n: i + 1 }),
        look: { appearance: randomAppearance(Math.floor(rng() * 2 ** 32)) },
      };
    const entry = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    return { name: entry.name, look: { appearance: entry.appearance } };
  });
}
