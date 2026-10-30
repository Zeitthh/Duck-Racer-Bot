import { MessageFlags } from 'discord.js';
import { duckChoices, listDucks } from '../lib/ducks';
import { browseDucks } from '../lib/gallery';
import { localizeOption, localizedCommand } from '../lib/locale';
import type { Command } from './types';

/**
 * Sin opciones, la galería de todos los patos del servidor. Con `usuario` o `pato`, directamente la tarjeta de ese pato.
 * En la tarjeta, ◀ ▶ pasan entre los patos de su dueño y el botón Galería vuelve a la cuadrícula. Solo muestra.
 */
export const duck: Command = {
  data: localizedCommand('duck')
    .addUserOption((o) => localizeOption(o, 'commands.duck.options.user'))
    .addStringOption((o) => localizeOption(o, 'commands.duck.options.duck').setAutocomplete(true)),

  async autocomplete(interaction, ctx) {
    // Sugiere los patos de la persona elegida en "usuario" (o los tuyos si aún no eligió a nadie).
    const owner = (interaction.options.get('user')?.value as string | undefined) ?? interaction.user.id;
    const ducks = await duckChoices(ctx.prisma, interaction.guildId, owner, interaction.options.getFocused());
    await interaction.respond(ducks.slice(0, 25));
  },

  async execute(interaction, ctx) {
    const target = interaction.options.getUser('user');
    const wanted = interaction.options.getString('duck');
    // Sin opciones: la galería de todo el servidor.
    if (!target && !wanted) return void (await browseDucks(interaction, ctx));

    const ducks = await listDucks(ctx.prisma, interaction.guildId, (target ?? interaction.user).id);
    if (!ducks.length)
      return void (await interaction.reply({
        content: target ? ctx.t('duck.noDuckOther', { user: `<@${target.id}>` }) : ctx.t('errors.noDuck'),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      }));
    const index = wanted ? ducks.findIndex((d) => d.id === wanted || d.name.toLowerCase() === wanted.toLowerCase()) : 0;
    if (index < 0)
      return void (await interaction.reply({ content: ctx.t('errors.duckNotFound'), flags: MessageFlags.Ephemeral }));
    await browseDucks(interaction, ctx, { ducks, index });
  },
};
