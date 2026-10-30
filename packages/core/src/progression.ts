import { XP_PER_MESSAGE } from './rules';

/** XP total para llegar a un nivel: 50·L·(L−1). Nivel 2 = 100, nivel 5 = 1000, nivel 10 = 4500. */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Nivel actual y avance dentro de él (para la barra de progreso). */
export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  return { level, current: xp - start, needed: xpForLevel(level + 1) - start };
}

/** XP que da un mensaje con el multiplicador de los eventos activos (1 si no hay). */
export const messageXp = (multiplier = 1) => Math.round(XP_PER_MESSAGE * multiplier);

/** Barra de texto: "▰▰▰▱▱▱▱▱▱▱". */
export function progressBar(current: number, total: number, width = 10): string {
  const filled = total > 0 ? Math.min(width, Math.floor((current / total) * width)) : 0;
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}
