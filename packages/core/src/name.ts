export const DUCK_NAME_MAX = 20;

export type DuckNameResult = { ok: true; name: string } | { ok: false; error: 'empty' | 'tooLong' | 'invalid' };

/** Limpia el nombre (espacios repetidos y extremos) y comprueba que sea válido. El largo se cuenta en caracteres. */
export function validateDuckName(raw: string): DuckNameResult {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'empty' };
  if ([...name].length > DUCK_NAME_MAX) return { ok: false, error: 'tooLong' };
  // Caracteres de control o invisibles (saltos de línea, ancho cero...).
  if (/[\p{Cc}\p{Cf}]/u.test(name.replace(/‍/g, ''))) return { ok: false, error: 'invalid' };
  return { ok: true, name };
}
