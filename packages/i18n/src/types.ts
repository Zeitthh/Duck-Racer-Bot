import type { enUS } from './locales/en-US';

/** Misma forma que en-US, pero con cualquier texto en lugar de los literales. */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof enUS>;

/** Rutas con puntos de todas las hojas: "adopt.previewTitle", "commands.ping.name"... */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Messages>;
