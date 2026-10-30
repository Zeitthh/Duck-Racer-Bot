import type { PrismaClient } from '@duckbot/db';
import { DiscordAPIError, RESTJSONErrorCodes, type Guild, type GuildMember, type Role } from 'discord.js';
import type { Logger } from '../logger';

/** Por servidor: la búsqueda o creación del rol en curso, para no crearlo dos veces si adoptan dos a la vez. */
const pending = new Map<string, Promise<Role>>();

/** Rol de quien tiene pato. Si no existe, lo crea (hace falta el permiso Gestionar roles). */
function adopterRole(guild: Guild, name: string): Promise<Role> {
  const existing = guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (existing) return Promise.resolve(existing);
  let creating = pending.get(guild.id);
  if (!creating) {
    creating = guild.roles
      .create({ name, mentionable: false, reason: 'DuckBot: rol para quien adopta un pato' })
      .finally(() => pending.delete(guild.id));
    pending.set(guild.id, creating);
  }
  return creating;
}

function explain(e: unknown, role: string): string {
  if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.MissingPermissions)
    return `DuckBot needs "Manage Roles" and its own role must be above "${role}" (Server Settings → Roles).`;
  return e instanceof Error ? e.message : String(e);
}

/** Da el rol de adoptador. Si no puede (permisos, jerarquía), lo deja en el log: la adopción no falla por esto. */
export async function giveAdopterRole(member: GuildMember, roleName: string, logger: Logger) {
  try {
    const role = await adopterRole(member.guild, roleName);
    if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'DuckBot: adoptó un pato');
  } catch (e) {
    logger.warn(`Could not give "${roleName}" to ${member.user.tag}:`, explain(e, roleName));
  }
}

/** Quita el rol de adoptador (cuando libera su último pato). Si no puede, lo deja en el log. */
export async function removeAdopterRole(member: GuildMember, roleName: string, logger: Logger) {
  const role = member.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
  if (!role) return;
  await member.roles
    .remove(role, 'DuckBot: ya no tiene patos')
    .catch((e: unknown) =>
      logger.warn(`Could not remove "${roleName}" from ${member.user.tag}:`, explain(e, roleName)),
    );
}

/** Al arrancar: da el rol a quienes ya tenían pato (por si se adoptaron antes de existir el rol o se lo quitaron). */
export async function syncAdopterRoles(guild: Guild, prisma: PrismaClient, roleName: string, logger: Logger) {
  const owners = await prisma.member.findMany({ where: { guildId: guild.id, ducks: { some: { strayedAt: null } } } });
  if (!owners.length) return;
  let role: Role;
  try {
    role = await adopterRole(guild, roleName);
  } catch (e) {
    logger.warn(`Could not set up "${roleName}" in ${guild.name}:`, explain(e, roleName));
    return;
  }
  let given = 0;
  for (const owner of owners) {
    // Quien ya no está en el servidor no se puede encontrar: se salta.
    const member = await guild.members.fetch(owner.discordId).catch(() => null);
    if (!member || member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, 'DuckBot: ya tenía pato');
      given++;
    } catch (e) {
      logger.warn(`Could not give "${roleName}" to ${member.user.tag}:`, explain(e, roleName));
      return;
    }
  }
  if (given) logger.info(`Gave "${roleName}" to ${given} duck owner(s) in ${guild.name}.`);
}
