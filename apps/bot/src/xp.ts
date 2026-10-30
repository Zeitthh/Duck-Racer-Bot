import { XP_COOLDOWN_MS, levelFromXp, levelUpReward, messageXp } from '@duckbot/core';
import { resolveLocale, t } from '@duckbot/i18n';
import type { Message } from 'discord.js';
import type { AppContext } from './context';
import { ensureMember } from './lib/ducks';
import { activeEvents, multiplierFor } from './lib/events';

/** Cada cuánto se guardan en la base de datos los mensajes que no dieron XP (solo es un contador). */
const FLUSH_MS = 60_000;

/**
 * Cuenta los mensajes y da XP: como mucho una vez por XP_COOLDOWN_MS y por persona, multiplicada por los eventos
 * activos. Al subir de nivel, el jugador gana PatoCoins y se anuncia en el canal de avisos.
 */
export function createMessageXpHandler(app: AppContext) {
  const { prisma, logger } = app;
  /** "servidor:usuario" -> id del miembro en la base de datos. */
  const memberIds = new Map<string, string>();
  /** "servidor:usuario" -> último momento en que dio XP (evita consultas mientras dura la espera). */
  const lastAward = new Map<string, number>();
  /** id del miembro -> mensajes que no dieron XP y aún no se guardaron (se guardan juntos cada FLUSH_MS). */
  const pending = new Map<string, number>();
  const countLater = (memberId: string) => pending.set(memberId, (pending.get(memberId) ?? 0) + 1);

  /** Guarda los mensajes contados. Si falla, se vuelven a sumar para el siguiente intento. */
  async function flush() {
    const batch = [...pending];
    pending.clear();
    for (const [id, n] of batch)
      await prisma.member.update({ where: { id }, data: { messages: { increment: n } } }).catch((e: unknown) => {
        pending.set(id, (pending.get(id) ?? 0) + n);
        logger.warn('Could not save message count:', e);
      });
  }
  setInterval(() => void flush(), FLUSH_MS).unref();

  const handle = async (message: Message) => {
    if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
    const key = `${message.guildId}:${message.author.id}`;
    try {
      let memberId = memberIds.get(key);
      if (!memberId) {
        memberId = (await ensureMember(prisma, message.guildId, message.author.id)).id;
        memberIds.set(key, memberId);
      }

      const now = Date.now();
      if (now - (lastAward.get(key) ?? 0) < XP_COOLDOWN_MS) return void countLater(memberId);

      const channelIds = [message.channelId];
      if (message.channel.isThread() && message.channel.parentId) channelIds.push(message.channel.parentId);
      const gained = messageXp(multiplierFor(await activeEvents(prisma, message.guildId), channelIds));

      // XP y, si sube de nivel, sus PatoCoins: todo o nada.
      const result = await prisma.$transaction(async (tx) => {
        // Condición en la propia escritura: aunque lleguen dos mensajes a la vez, solo uno da XP.
        const { count } = await tx.member.updateMany({
          where: { id: memberId, OR: [{ lastXpAt: null }, { lastXpAt: { lte: new Date(now - XP_COOLDOWN_MS) } }] },
          data: { xp: { increment: gained }, messages: { increment: 1 }, lastXpAt: new Date(now) },
        });
        if (count === 0) return null;
        const member = await tx.member.findUniqueOrThrow({
          where: { id: memberId },
          include: { _count: { select: { ducks: { where: { strayedAt: null } } } } },
        });
        const level = levelFromXp(member.xp);
        let reward = 0;
        for (let l = levelFromXp(member.xp - gained) + 1; l <= level; l++) {
          reward += levelUpReward(l);
          await tx.coinTransaction.create({
            data: { memberId, amount: levelUpReward(l), reason: 'level_up', refId: String(l) },
          });
        }
        if (reward) await tx.member.update({ where: { id: memberId }, data: { coins: { increment: reward } } });
        return { level, reward, ducks: member._count.ducks };
      });
      if (!result) return void countLater(memberId);
      lastAward.set(key, now);

      // Las PatoCoins se dan siempre; el aviso, solo a quien tiene algún pato (para no anunciar a quien no juega).
      const { level, reward } = result;
      if (!reward || !result.ducks) return;

      const locale = resolveLocale(message.guild.preferredLocale) ?? app.config.DEFAULT_LOCALE;
      // Al canal de avisos (LEVEL_UP_CHANNEL) para no llenar los demás; si no existe, donde se escribió.
      const wanted = app.config.LEVEL_UP_CHANNEL.toLowerCase().replace(/^#/, '');
      const announcements = message.guild.channels.cache.find((c) => c.name.toLowerCase() === wanted && c.isSendable());
      const channel = announcements?.isSendable() ? announcements : message.channel;
      await channel
        .send({
          content: t(locale, 'xp.levelUp', { user: `<@${message.author.id}>`, level, coins: reward }),
          allowedMentions: { parse: [] },
        })
        .catch((e: unknown) => logger.warn('Could not announce level up:', e));
    } catch (e) {
      logger.error('Message XP failed:', e);
    }
  };

  return { handle, flush };
}
