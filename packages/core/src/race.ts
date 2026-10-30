import { mulberry32 } from './random';

export const TRACK_LENGTH = 100;
/** Avance medio por tick: con el azar, una carrera dura unos 25–35 ticks. */
const BASE_SPEED = 3.5;
/** Ventaja por nivel (+0.5 % por nivel, hasta +10 %): el nivel ayuda, pero no decide la carrera. */
const LEVEL_BONUS = 0.005;
const MAX_LEVEL_BONUS = 0.1;
/** "Forma del día": cada pato corre toda la carrera un poco más rápido o más lento (±12 %). */
const FORM_SPREAD = 0.12;
const TURBO_CHANCE = 0.08;
const TURBO_FACTOR = 1.6;
/** Límite de seguridad. */
const MAX_TICKS = 200;

export interface Racer {
  level: number;
}

export interface RaceResult {
  /** Posición (0..TRACK_LENGTH) de cada pato en cada tick, empezando por la salida. */
  ticks: number[][];
  /** Índices de los patos en orden de llegada. */
  order: number[];
  /** Ticks (con fracción) que tardó cada pato en llegar. */
  times: number[];
}

/** Simula una carrera. Con la misma semilla y los mismos niveles, el resultado es siempre el mismo. */
export function simulateRace(racers: Racer[], seed: number): RaceResult {
  const rng = mulberry32(seed);
  const speed = racers.map(
    (r) =>
      BASE_SPEED * (1 + Math.min(MAX_LEVEL_BONUS, (r.level - 1) * LEVEL_BONUS)) * (1 + (rng() * 2 - 1) * FORM_SPREAD),
  );
  const pos = racers.map(() => 0);
  const times = racers.map(() => Infinity);
  const ticks = [pos.slice()];

  for (let tick = 1; tick <= MAX_TICKS && times.some((t) => t === Infinity); tick++) {
    racers.forEach((_, i) => {
      if (times[i] !== Infinity) return;
      let step = speed[i]! * (0.7 + rng() * 0.6);
      if (rng() < TURBO_CHANCE) step *= TURBO_FACTOR;
      const before = pos[i]!;
      pos[i] = Math.min(TRACK_LENGTH, before + step);
      // Momento exacto en que cruzó la meta dentro del tick: desempata a los que llegan en el mismo tick.
      if (before + step >= TRACK_LENGTH) times[i] = tick - 1 + (TRACK_LENGTH - before) / step;
    });
    ticks.push(pos.slice());
  }

  const order = racers.map((_, i) => i).sort((a, b) => times[a]! - times[b]! || a - b);
  return { ticks, order, times };
}
