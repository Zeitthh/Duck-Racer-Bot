import { DUCK_NAME_MAX, validateDuckName } from '@duckbot/core';
import { MessageFlags, escapeMarkdown } from 'discord.js';
import { duckChoices, nameTaken, pickDuck } from '../lib/ducks';
import { localizeOption, localizedCommand } from '../lib/locale';
import { nameErrorMessage } from '../lib/names';
import type { Command } from './types';

/** Solo se puede renombrar un pato propio: pickDuck busca únicamente entre los patos de quien usa el comando. */
export const rename: Command = {
  data: localizedCommand('rename')
    .addStringOption((o) =>
      localizeOption(o, 'commands.rename.options.name').setRequired(true).setMaxLength(DUCK_NAME_MAX),
    )
    .addStringOption((o) => localizeOption(o, 'commands.rename.options.duck').setAutocomplete(true)),

  async autocomplete(interaction, ctx) {
    await interaction.respond(
      (await duckChoices(ctx.prisma, interaction.guildId, interaction.user.id, interaction.options.getFocused())).slice(
        0,
        25,
      ),
    );
  },

  async execute(interaction, ctx) {
    const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const checked = validateDuckName(interaction.options.getString('name', true));
    if (!checked.ok) return void (await reply(nameErrorMessage(checked.error, ctx)));

    const picked = await pickDuck(
      ctx.prisma,
      interaction.guildId,
      interaction.user.id,
      interaction.options.getString('duck'),
    );
    if (!picked.ok) return void (await reply(ctx.t(picked.error)));
    if (nameTaken(picked.ducks, checked.name, picked.duck.id))
      return void (await reply(ctx.t('name.duplicate', { name: escapeMarkdown(checked.name) })));

    await ctx.prisma.duck.update({ where: { id: picked.duck.id }, data: { name: checked.name } });
    await reply(ctx.t('rename.done', { old: escapeMarkdown(picked.duck.name), name: escapeMarkdown(checked.name) }));
  },
};
