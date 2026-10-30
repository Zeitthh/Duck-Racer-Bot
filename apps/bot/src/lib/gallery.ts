import { ACCESSORY_COLORS, getAccessory } from '@duckbot/core';
import { backgroundFor, renderDuckSheet, renderDuckStrip } from '@duckbot/render';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  escapeMarkdown,
  type ChatInputCommandInteraction,
  type Guild,
} from 'discord.js';
import type { Ctx } from '../context';
import { accessoryName, ownedAccessories, type OwnedSource } from './cosmetics';
import { OWNED, colorOf, duckCard, ensureMember, lookOf, type DuckWithMember } from './ducks';

/** Patos por página de la galería (4 × 3). */
export const PAGE_SIZE = 12;
/** Tiempo que funcionan los botones. */
const BROWSE_MS = 5 * 60_000;
const ID = {
  prev: 'gal:prev',
  next: 'gal:next',
  back: 'gal:back',
  pick: 'gal:pick',
  pos: 'gal:pos',
  wardrobe: 'gal:wardrobe',
  wear: 'gal:wear',
  takeOff: 'gal:takeoff',
  color: 'gal:color',
  toCard: 'gal:tocard',
} as const;
/** Opción "color de fábrica" del menú de colores. */
const DEFAULT_COLOR = '-';

const sourceLabel = (source: OwnedSource, ctx: Ctx) =>
  source.kind === 'role'
    ? ctx.t('wardrobe.sourceRole', { role: `<@&${source.roleId}>` })
    : ctx.t(source.kind === 'shop' ? 'wardrobe.sourceShop' : 'wardrobe.sourceGrant');

/** Todos los patos con dueño del servidor, del más antiguo al más nuevo (los de la galería). */
const serverDucks = (ctx: Ctx, guildId: string): Promise<DuckWithMember[]> =>
  ctx.prisma.duck.findMany({
    where: { ...OWNED, member: { guildId } },
    include: { member: true },
    orderBy: { createdAt: 'asc' },
  });

/** Nombres visibles de los dueños (para el menú, que no admite menciones). Quien ya no está, sin nombre. */
async function displayNames(guild: Guild, ducks: DuckWithMember[]) {
  const ids = [...new Set(ducks.map((d) => d.member.discordId))];
  const names = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const member = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
      if (member) names.set(id, member.displayName);
    }),
  );
  return names;
}

const arrow = (id: string, emoji: string) =>
  new ButtonBuilder().setCustomId(id).setStyle(ButtonStyle.Secondary).setEmoji(emoji);
const position = (label: string) =>
  new ButtonBuilder().setCustomId(ID.pos).setStyle(ButtonStyle.Secondary).setLabel(label).setDisabled(true);

/**
 * Mensaje privado para ver patos. Sin `start`, empieza en la galería: la cuadrícula de todos los patos del servidor
 * (◀ ▶ entre páginas y un menú para abrir uno). Con `start`, empieza en la tarjeta de `start.ducks[start.index]`. En la
 * tarjeta, ◀ ▶ pasan entre los patos de esa misma persona (si tiene más de uno) y el botón Galería vuelve a la
 * cuadrícula. En la tarjeta de un pato propio, el botón Vestuario recorre tus cosméticos con ◀ ▶ para ponérselos,
 * quitárselos o cambiarles el color; es lo único que cambia algo, y solo en tus propios patos.
 */
export async function browseDucks(
  interaction: ChatInputCommandInteraction<'cached'>,
  ctx: Ctx,
  start?: { ducks: DuckWithMember[]; index: number },
) {
  const title = ctx.t('gallery.title', { name: interaction.guild.name });
  /** Todos los patos del servidor (se cargan al abrir la galería). */
  let all: DuckWithMember[] = [];
  /** Los patos de la persona cuya tarjeta se ve, y cuál de ellos. */
  let owner = start?.ducks ?? [];
  let current = start?.index ?? 0;
  let view: 'grid' | 'card' | 'wardrobe' = 'card';
  let page = 0;
  const pages = () => Math.ceil(all.length / PAGE_SIZE);
  /** Vestuario: los cosméticos de quien mira (solo en la tarjeta de sus propios patos), cuál se ve y un aviso. */
  let closet: { id: string; source: OwnedSource }[] = [];
  let item = 0;
  let status = '';
  const mine = () => owner[current]?.member.discordId === interaction.user.id;

  /** Abre el vestuario del pato de la tarjeta, empezando por el cosmético que lleva puesto. */
  const openWardrobe = async () => {
    const member = await ensureMember(ctx.prisma, interaction.guildId, interaction.user.id);
    const owned = await ownedAccessories(ctx.prisma, interaction.guildId, member, interaction.member);
    closet = [...owned]
      .flatMap(([id, source]) => (getAccessory(id) ? [{ id, source }] : []))
      .sort((a, b) =>
        accessoryName(getAccessory(a.id)!, ctx.locale).localeCompare(
          accessoryName(getAccessory(b.id)!, ctx.locale),
          ctx.locale,
        ),
      );
    item = Math.max(
      0,
      closet.findIndex((c) => c.id === owner[current]!.accessoryId),
    );
    view = 'wardrobe';
  };

  /**
   * Pone (o quita, con null) un cosmético al pato de la tarjeta. Solo si sigue siendo de quien mira y tiene dueño, y
   * solo cosméticos que de verdad tiene (pudo perder el rol que se lo daba).
   */
  const wear = async (accessoryId: string | null, color: string | null) => {
    const duck = owner[current]!;
    const acc = getAccessory(accessoryId);
    if (acc) {
      const member = await ensureMember(ctx.prisma, interaction.guildId, interaction.user.id);
      const owned = await ownedAccessories(ctx.prisma, interaction.guildId, member, interaction.member);
      if (!owned.has(acc.id)) return ctx.t('equip.notOwned', { name: accessoryName(acc, ctx.locale) });
    }
    const { count } = await ctx.prisma.duck.updateMany({
      where: { ...OWNED, id: duck.id, member: { discordId: interaction.user.id } },
      data: { accessoryId: acc?.id ?? null, accessoryColor: acc ? color : null },
    });
    if (!count) return ctx.t('errors.duckNotFound');
    const updated = { ...duck, accessoryId: acc?.id ?? null, accessoryColor: acc ? color : null };
    owner = owner.map((d) => (d.id === duck.id ? updated : d));
    all = all.map((d) => (d.id === duck.id ? updated : d));
    const duckName = escapeMarkdown(duck.name);
    return acc
      ? ctx.t('equip.done', { duck: duckName, name: accessoryName(acc, ctx.locale) })
      : ctx.t('equip.removed', { duck: duckName });
  };

  /** Abre la galería en la página del pato que se estaba viendo (o en la primera). */
  const openGallery = async () => {
    if (!all.length) all = await serverDucks(ctx, interaction.guildId);
    const shown = owner[current]?.id;
    page = Math.floor(
      Math.max(
        0,
        all.findIndex((d) => d.id === shown),
      ) / PAGE_SIZE,
    );
    view = 'grid';
  };
  if (!owner.length) {
    await openGallery();
    if (!all.length)
      return void (await interaction.reply({ content: ctx.t('gallery.empty'), flags: MessageFlags.Ephemeral }));
  }

  const grid = async () => {
    const first = page * PAGE_SIZE;
    const slice = all.slice(first, first + PAGE_SIZE);
    const png = renderDuckSheet(
      slice.map((d) => ({ look: lookOf(d), background: backgroundFor(d.id) })),
      { firstNumber: first + 1 },
    );
    const names = await displayNames(interaction.guild, slice);
    const embed = new EmbedBuilder()
      .setColor(0xffd21f)
      .setTitle(title)
      .setDescription(
        slice
          .map((d, i) =>
            ctx.t('gallery.line', {
              n: first + i + 1,
              name: escapeMarkdown(d.name),
              owner: `<@${d.member.discordId}>`,
              level: d.level,
            }),
          )
          .join('\n'),
      )
      .setImage('attachment://ducks.png')
      .setFooter({ text: ctx.t('gallery.page', { page: page + 1, pages: pages(), count: all.length }) });
    const menu = new StringSelectMenuBuilder()
      .setCustomId(ID.pick)
      .setPlaceholder(ctx.t('gallery.pick'))
      .addOptions(
        slice.map((d, i) => ({
          label: `${first + i + 1}. ${d.name}`,
          value: String(first + i),
          ...(names.has(d.member.discordId) ? { description: names.get(d.member.discordId)!.slice(0, 100) } : {}),
        })),
      );
    const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    ];
    if (pages() > 1)
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          arrow(ID.prev, '◀️'),
          position(`${page + 1} / ${pages()}`),
          arrow(ID.next, '▶️'),
        ),
      );
    return { content: '', embeds: [embed], files: [new AttachmentBuilder(png, { name: 'ducks.png' })], components };
  };

  const card = () => {
    const buttons = [
      ...(owner.length > 1
        ? [arrow(ID.prev, '◀️'), position(`${current + 1} / ${owner.length}`), arrow(ID.next, '▶️')]
        : []),
      new ButtonBuilder()
        .setCustomId(ID.back)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🦆')
        .setLabel(ctx.t('gallery.back')),
      // El vestuario solo aparece en tus propios patos: no se puede vestir el pato de otra persona.
      ...(mine()
        ? [
            new ButtonBuilder()
              .setCustomId(ID.wardrobe)
              .setStyle(ButtonStyle.Success)
              .setEmoji('👕')
              .setLabel(ctx.t('wardrobe.button')),
          ]
        : []),
    ];
    return {
      content: status,
      ...duckCard(owner[current]!, ctx),
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
    };
  };

  /** Un cosmético de tu vestuario cada vez, probado en el pato de la tarjeta. */
  const wardrobe = () => {
    const duck = owner[current]!;
    const back = new ButtonBuilder()
      .setCustomId(ID.toCard)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(ctx.t('wardrobe.back'));
    const takeOff = new ButtonBuilder()
      .setCustomId(ID.takeOff)
      .setStyle(ButtonStyle.Danger)
      .setLabel(ctx.t('wardrobe.takeOff'))
      .setDisabled(!duck.accessoryId);
    const entry = closet[item];
    if (!entry)
      return {
        content: status || ctx.t('wardrobe.empty'),
        embeds: [],
        files: [],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(back, takeOff)],
      };

    const acc = getAccessory(entry.id)!;
    const wearing = duck.accessoryId === acc.id;
    const background = backgroundFor(duck.id);
    const png = renderDuckStrip(
      { ...lookOf(duck), accessory: acc, accessoryColor: wearing ? duck.accessoryColor : null },
      { scale: 8, background },
    );
    const embed = new EmbedBuilder()
      .setColor(colorOf(background))
      .setTitle(ctx.t('wardrobe.title', { duck: duck.name }))
      .setDescription(
        [
          `**${accessoryName(acc, ctx.locale)}** · ${sourceLabel(entry.source, ctx)}`,
          ...(wearing ? [ctx.t('wardrobe.wearing')] : []),
        ].join('\n'),
      )
      .setImage('attachment://wardrobe.png');
    const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    if (closet.length > 1)
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          arrow(ID.prev, '◀️'),
          position(`${item + 1} / ${closet.length}`),
          arrow(ID.next, '▶️'),
        ),
      );
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(ID.wear)
          .setStyle(ButtonStyle.Success)
          .setEmoji('🦆')
          .setLabel(ctx.t('wardrobe.wear'))
          .setDisabled(wearing),
        takeOff,
        back,
      ),
      // Elegir un color se lo pone con ese color.
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(ID.color)
          .setPlaceholder(ctx.t('wardrobe.color'))
          .addOptions([
            { label: ctx.t('wardrobe.defaultColor'), value: DEFAULT_COLOR },
            ...ACCESSORY_COLORS.map((c) => ({ label: ctx.t(`colors.${c.id}`), value: c.hex })),
          ]),
      ),
    );
    return {
      content: status,
      embeds: [embed],
      files: [new AttachmentBuilder(png, { name: 'wardrobe.png' })],
      components,
    };
  };

  const render = () => (view === 'grid' ? grid() : view === 'wardrobe' ? wardrobe() : card());
  const response = await interaction.reply({
    ...(await render()),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
    withResponse: true,
  });
  const message = response.resource?.message;
  if (!message) return;

  const collector = message.createMessageComponentCollector({ time: BROWSE_MS });
  collector.on('collect', async (i) => {
    try {
      const wrap = (n: number, size: number) => (n + size) % size;
      status = '';
      if (i.isStringSelectMenu() && i.customId === ID.color) {
        const entry = closet[item];
        if (entry) status = await wear(entry.id, i.values[0] === DEFAULT_COLOR ? null : i.values[0]!);
      } else if (i.customId === ID.wardrobe && mine()) {
        await openWardrobe();
      } else if (i.customId === ID.wear) {
        const entry = closet[item];
        if (entry) status = await wear(entry.id, null);
      } else if (i.customId === ID.takeOff) {
        status = await wear(null, null);
      } else if (i.customId === ID.toCard) {
        view = 'card';
      } else if (i.isStringSelectMenu() && i.customId === ID.pick) {
        // Al abrir un pato de la galería, las flechas de su tarjeta pasan entre los patos de su dueño.
        const picked = all[Number(i.values[0])]!;
        owner = all.filter((d) => d.memberId === picked.memberId);
        current = owner.indexOf(picked);
        view = 'card';
      } else if (i.customId === ID.back) {
        await openGallery();
      } else if (i.customId === ID.prev || i.customId === ID.next) {
        const step = i.customId === ID.next ? 1 : -1;
        if (view === 'grid') page = wrap(page + step, pages());
        else if (view === 'wardrobe') item = wrap(item + step, Math.max(1, closet.length));
        else current = wrap(current + step, owner.length);
      }
      // attachments: [] cambia la imagen anterior por la nueva en vez de sumarla.
      await i.update({ ...(await render()), attachments: [], allowedMentions: { parse: [] } });
    } catch (e) {
      ctx.logger.error('Duck browser failed:', e);
    }
  });
  // Al caducar, se quitan los botones para que no parezca que siguen funcionando.
  collector.on('end', () => void interaction.editReply({ components: [] }).catch(() => {}));
}
