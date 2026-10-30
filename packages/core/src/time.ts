/** ¿Es un nombre de zona horaria IANA válido ("America/Mexico_City")? */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Todas las zonas horarias que conoce Node. */
export const TIME_ZONES: string[] = Intl.supportedValuesOf('timeZone');

/** Fecha y hora locales de un instante en una zona. */
function localParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

/** Día local "YYYY-MM-DD" de un instante en una zona: sirve para contar cosas "por día". */
export function dayKey(date: Date, tz: string): string {
  const { y, m, d } = localParts(date, tz);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante. */
function offsetMs(date: Date, tz: string): number {
  const p = localParts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante de la próxima medianoche local (cuándo se reinician los límites diarios). */
export function nextMidnight(date: Date, tz: string): Date {
  const { y, m, d } = localParts(date, tz);
  const midnightAsUtc = Date.UTC(y, m - 1, d + 1);
  // Se corrige dos veces por si la medianoche cae justo en un cambio de horario.
  let guess = midnightAsUtc - offsetMs(new Date(midnightAsUtc), tz);
  guess = midnightAsUtc - offsetMs(new Date(guess), tz);
  return new Date(guess);
}
