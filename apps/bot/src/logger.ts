export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type Logger = Record<LogLevel, (...args: unknown[]) => void>;

/** Logger mínimo por consola: muestra los mensajes del nivel dado y superiores. */
export function createLogger(level: LogLevel): Logger {
  const min = LOG_LEVELS.indexOf(level);
  const out = { debug: console.debug, info: console.info, warn: console.warn, error: console.error };
  return Object.fromEntries(
    LOG_LEVELS.map((l, i) => [
      l,
      (...args: unknown[]) => {
        if (i >= min) out[l](`${new Date().toISOString()} ${l.toUpperCase().padEnd(5)}`, ...args);
      },
    ]),
  ) as Logger;
}
