// Registra los slash commands en el servidor de DISCORD_DEV_GUILD_ID. Por servidor se actualizan al instante.
import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import { loadConfig } from './config';

const config = loadConfig();
const rest = new REST().setToken(config.DISCORD_TOKEN);
const body = commands.map((c) => c.data.toJSON());

await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_DEV_GUILD_ID), { body });
console.info(`Registered ${body.length} commands: ${body.map((c) => `/${c.name}`).join(', ')}`);
