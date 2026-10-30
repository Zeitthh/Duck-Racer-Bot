import { t } from '@duckbot/i18n';
import { MessageFlags, type Interaction } from 'discord.js';
import { commandsByName } from './commands';
import { withLocale, type AppContext } from './context';
import { localeOf } from './lib/locale';

/** Cuándo arrancó este proceso: los botones de mensajes anteriores ya no tienen a nadie escuchándolos. */
const STARTED_AT = Date.now();

export async function handleInteraction(interaction: Interaction, app: AppContext): Promise<void> {
  // Los botones y menús los atienden los collectors de cada comando. Si el mensaje es de antes de reiniciar el bot,
  // ese collector ya no existe: se avisa en privado en vez de dejar que Discord muestre "La interacción falló".
  if (interaction.isMessageComponent()) {
    if (interaction.message.createdTimestamp < STARTED_AT) {
      const locale = localeOf(interaction, app.config.DEFAULT_LOCALE);
      await interaction
        .reply({ content: t(locale, 'errors.expiredMenu'), flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
    return;
  }
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;
  const ctx = withLocale(app, localeOf(interaction, app.config.DEFAULT_LOCALE));
  const command = commandsByName.get(interaction.commandName);

  if (interaction.isAutocomplete()) {
    if (!command?.autocomplete || !interaction.inCachedGuild()) return void (await interaction.respond([]));
    try {
      await command.autocomplete(interaction, ctx);
    } catch (e) {
      app.logger.error(`Autocomplete /${interaction.commandName} failed:`, e);
    }
    return;
  }

  if (!command) {
    await interaction.reply({ content: ctx.t('errors.unknownCommand'), flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: ctx.t('errors.guildOnly'), flags: MessageFlags.Ephemeral });
    return;
  }

  app.logger.debug(`/${interaction.commandName} by ${interaction.user.tag} (${ctx.locale})`);
  try {
    await command.execute(interaction, ctx);
  } catch (e) {
    app.logger.error(`/${interaction.commandName} failed:`, e);
    const reply = { content: t(ctx.locale, 'errors.generic'), flags: MessageFlags.Ephemeral } as const;
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
}
