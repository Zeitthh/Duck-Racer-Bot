/** Lado del pato en píxeles. duck-editor también tiene 16×16, pero el bot usa solo el 8×8. */
export const DUCK_SIZE = 8;

/** Las 4 caras de cada pato, en el orden de duck-editor (índices 0..3). */
export const FACE_NAMES = ['right', 'front', 'left', 'back'] as const;
export type FaceName = (typeof FACE_NAMES)[number];
export const FACE_COUNT = FACE_NAMES.length;

/** DUCK_SIZE × DUCK_SIZE valores: 0 = transparente, n = palette[n - 1]. */
export type Frame = number[];

/** Cómo se ve un pato: su paleta y sus 4 caras. Es lo que se guarda en la base de datos. */
export interface Appearance {
  /** Colores "#rrggbb". */
  palette: string[];
  /** Una cara por elemento de FACE_NAMES. */
  frames: Frame[];
}
