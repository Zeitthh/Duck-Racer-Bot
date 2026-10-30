import { join } from 'node:path';
import { createPrismaClient } from '@duckbot/db';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadAccessories, loadCatalog } from './catalog';
import { loadConfig } from './config';
import type { AppContext } from './context';
import { handleInteraction } from './interactions';
import { syncAdopterRoles } from './lib/roles';
import { pruneLedger, setupGuild, stockShop, strayDepartedDucks } from './lib/upkeep';
import { createLogger } from './logger';
import { assetsDir } from './paths';
import { createMessageXpHandler } from './xp';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const prisma = createPrismaClient();
// El arte (cosméticos y catálogo) vive en ASSETS_DIR, no en el código. Los cosméticos se cargan antes que nada: la
// tienda, el vestuario y el arranque (stockShop) los necesitan.
const assets = assetsDir(config.ASSETS_DIR);
const cosmetics = loadAccessories(join(assets, 'accessories.json'), logger);
const catalog = loadCatalog(join(assets, 'catalog'), logger);
const app: AppContext = { config, logger, prisma, catalog };

// GuildMessages avisa de cada mensaje (para dar XP). No hace falta MessageContent: el bot no lee el texto.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Las carreras que quedaron abiertas al apagar el bot ya no tienen botones que funcionen.
const orphaned = await prisma.race.updateMany({ where: { status: 'OPEN' }, data: { status: 'CANCELLED' } });
if (orphaned.count) logger.info(`Cancelled ${orphaned.count} race(s) left open by a previous run.`);

/** Cada cuánto se revisa si algún dueño de patos dejó el servidor y se borran los movimientos viejos. */
const UPKEEP_MS = 6 * 3_600_000;

const upkeep = async () => {
  for (const guild of client.guilds.cache.values())
    await strayDepartedDucks(guild, prisma, logger).catch((e: unknown) => logger.error('Stray sweep failed:', e));
  await pruneLedger(prisma, logger).catch((e: unknown) => logger.error('Ledger cleanup failed:', e));
};

client.once(Events.ClientReady, async (c) => {
  logger.info(
    `Logged in as ${c.user.tag}. Catalog: ${catalog.entries.length} ducks. Cosmetics: ${cosmetics}. Time zone: ${config.TIMEZONE}.`,
  );
  for (const guild of c.guilds.cache.values()) {
    await setupGuild(prisma, guild.id, config.TIMEZONE);
    await stockShop(prisma, guild.id, logger);
    await syncAdopterRoles(guild, prisma, config.ADOPTER_ROLE, logger);
  }
  await upkeep();
  setInterval(() => void upkeep(), UPKEEP_MS).unref();
});
const messageXp = createMessageXpHandler(app);
client.on(Events.InteractionCreate, (interaction) => void handleInteraction(interaction, app));
client.on(Events.MessageCreate, messageXp.handle);
client.on(Events.Error, (e) => logger.error('Discord client error:', e));

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down…`);
  await messageXp.flush();
  await client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await client.login(config.DISCORD_TOKEN);
