import * as site from "./site";

/** Una label o annotation del workload usada como filtro opcional. */
export interface ExtraFilter {
  /** Identificador estable (letras y números): se usa en el estado de los filtros. */
  id: string;
  /** Texto del selector. */
  label: string;
  /** Clave exacta de la label o annotation del workload. */
  key: string;
}

/**
 * Filtros opcionales declarados en `site.ts`. Se leen de forma tolerante: un
 * `site.ts` copiado antes de que existiera `EXTRA_FILTERS` sigue compilando y
 * simplemente no muestra filtros extra.
 */
export const EXTRA_FILTERS: ExtraFilter[] = (
  ((site as Record<string, unknown>).EXTRA_FILTERS as ExtraFilter[] | undefined) ?? []
).filter((f) => /^[a-z0-9]+$/i.test(f.id) && f.key.trim() !== "");
