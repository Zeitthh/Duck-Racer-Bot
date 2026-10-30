import {
  MAX_DUCK_LEVEL,
  getAccessory,
  levelProgress,
  parseAppearance,
  progressBar,
  trainCost,
  type DuckLook,
} from '@duckbot/core';
import type { Duck, Member, PrismaClient } from '@duckbot/db';
import type { MessageKey } from '@duckbot/i18n';
import { backgroundFor, renderDuckGif, renderDuckStrip } from '@duckbot/render';
import { AttachmentBuilder, EmbedBuilder, escapeMarkdown } from 'discord.js';
import type { Ctx } from '../context';
import { accessoryName } from './cosmetics';

export type DuckWithMember = Duck & { member: Member };

/** Filtro de los patos que tienen dueño (los demás están esperando a que alguien los adopte). */
export const OWNED = { strayedAt: null } as const;

/** Los patos de alguien, del más antiguo al más nuevo. */
export const listDucks = (prisma: PrismaClient, guildId: string, discordId: string): Promise<DuckWithMember[]> =>
  prisma.duck.findMany({
    where: { ...OWNED, member: { guildId, discordId } },
    include: { member: true },
    orderBy: { createdAt: 'asc' },
  });

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿Ya hay entre `ducks` uno con ese nombre (sin distinguir mayúsculas ni acentos)? */
export const nameTaken = (ducks: Duck[], name: string, exceptId?: string) =>
  ducks.some((d) => d.id !== exceptId && fold(d.name) === fold(name));

export type DuckPick = { ok: true; duck: DuckWithMember; ducks: DuckWithMember[] } | { ok: false; error: MessageKey };

/**
 * El pato de `discordId` que indica la opción "pato" (su id, que es lo que manda el autocompletado, o su nombre).
 * Solo busca entre los patos de esa persona: nunca devuelve el de otra. Sin opción, vale si tiene uno solo.
 */
export async function pickDuck(
  prisma: PrismaClient,
  guildId: string,
  discordId: string,
  value: string | null,
): Promise<DuckPick> {
  const ducks = await listDucks(prisma, guildId, discordId);
  if (!ducks.length) return { ok: false, error: 'errors.noDuck' };
  if (value === null)
    return ducks.length === 1 ? { ok: true, duck: ducks[0]!, ducks } : { ok: false, error: 'errors.chooseDuck' };
  const duck = ducks.find((d) => d.id === value) ?? ducks.find((d) => fold(d.name) === fold(value));
  return duck ? { ok: true, duck, ducks } : { ok: false, error: 'errors.duckNotFound' };
}

/** Autocompletado de la opción "pato": los patos de esa persona cuyo nombre contiene el texto. */
export async function duckChoices(prisma: PrismaClient, guildId: string, discordId: string, query: string) {
  const q = fold(query.trim());
  return (await listDucks(prisma, guildId, discordId))
    .filter((d) => fold(d.name).includes(q))
    .map((d) => ({ name: d.name, value: d.id }));
}

export const findMember = (prisma: PrismaClient, guildId: string, discordId: string) =>
  prisma.member.findUnique({ where: { discordId_guildId: { discordId, guildId } } });

/** Crea el servidor si todavía no existe. */
export const ensureGuild = (prisma: PrismaClient, guildId: string) =>
  prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

/** Crea el servidor y el miembro si todavía no existen. */
export async function ensureMember(prisma: PrismaClient, guildId: string, discordId: string) {
  await ensureGuild(prisma, guildId);
  return prisma.member.upsert({
    where: { discordId_guildId: { discordId, guildId } },
    create: { discordId, guildId },
    update: {},
  });
}

/** Lo necesario para dibujar un pato guardado: apariencia y accesorio puesto. */
export const lookOf = (duck: Duck): DuckLook => ({
  appearance: parseAppearance(duck.appearance),
  accessory: getAccessory(duck.accessoryId),
  accessoryColor: duck.accessoryColor,
});

export const colorOf = (hex: string) => parseInt(hex.slice(1), 16);

/** Embed + imagen (4 caras en fila) para elegir un pato antes de adoptarlo. */
export function previewMessage(look: DuckLook, key: string, title: string, description: string) {
  const background = backgroundFor(key);
  const file = new AttachmentBuilder(renderDuckStrip(look, { scale: 8, background }), { name: 'preview.png' });
  const embed = new EmbedBuilder()
    .setColor(colorOf(background))
    .setTitle(title)
    .setDescription(description)
    .setImage('attachment://preview.png');
  return { embeds: [embed], files: [file] };
}

/**
 * Tarjeta de un pato: GIF girando, nivel del pato y del dueño, cosmético, dueño, fecha de adopción y origen. No muestra
 * PatoCoins: la tarjeta se puede ver de patos ajenos, y el saldo es privado (/saldo).
 */
export function duckCard(duck: DuckWithMember, ctx: Ctx) {
  const background = backgroundFor(duck.id);
  const file = new AttachmentBuilder(renderDuckGif(lookOf(duck), { scale: 12, background }), { name: 'duck.gif' });
  const { level, current, needed } = levelProgress(duck.member.xp);
  const accessory = getAccessory(duck.accessoryId);
  const embed = new EmbedBuilder()
    .setColor(colorOf(background))
    .setTitle(`🦆 ${escapeMarkdown(duck.name)}`)
    .setImage('attachment://duck.gif')
    .addFields(
      {
        name: ctx.t('duck.level', { level: duck.level, max: MAX_DUCK_LEVEL }),
        value:
          duck.level < MAX_DUCK_LEVEL
            ? ctx.t('duck.trainNext', { price: trainCost(duck.level) })
            : ctx.t('duck.maxLevel'),
      },
      {
        name: ctx.t('duck.ownerLevel', { level }),
        value: ctx.t('duck.xp', { bar: progressBar(current, needed), current, needed }),
      },
      {
        name: ctx.t('duck.accessory'),
        value: accessory ? accessoryName(accessory, ctx.locale) : ctx.t('duck.noAccessory'),
        inline: true,
      },
      { name: ctx.t('duck.origin'), value: originLabel(duck.origin, ctx), inline: true },
      { name: ctx.t('duck.owner'), value: `<@${duck.member.discordId}>`, inline: true },
      { name: ctx.t('duck.adoptedAt'), value: `<t:${Math.floor(duck.createdAt.getTime() / 1000)}:D>`, inline: true },
    );
  return { embeds: [embed], files: [file] };
}

function originLabel(origin: string, ctx: Ctx): string {
  if (!origin.startsWith('catalog:')) return ctx.t('duck.originRandom');
  const id = origin.slice('catalog:'.length);
  return ctx.t('duck.originCatalog', { entry: ctx.catalog.get(id)?.name ?? id });
}
