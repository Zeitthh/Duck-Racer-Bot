/** Generador de números pseudoaleatorios con semilla: la misma semilla da siempre la misma secuencia. */
export type Rng = () => number;

/** mulberry32: rápido, de 32 bits y suficiente para juegos. Devuelve valores en [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla nueva de 32 bits. */
export const randomSeed = () => Math.floor(Math.random() * 4294967296);
