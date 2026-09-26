import type { Lang, Localized } from "../i18n";
import * as site from "./site";

/** Una label o annotation del workload usada como filtro opcional. */
export interface ExtraFilter {
  /** Identificador estable, solo letras y números (sin guiones): se usa en el estado de los filtros. */
  id: string;
  /** Texto del selector: uno solo, o `{ en, es }` para verlo en cada idioma. */
  label: string | Localized;
  /** Clave exacta de la label o annotation del workload. */
  key: string;
}

const VALID_ID = /^[a-z0-9]+$/i;

/**
 * Lo declarado en `site.ts`, leído de forma tolerante: un `site.ts` copiado
 * antes de que existiera `EXTRA_FILTERS` sigue compilando y simplemente no
 * muestra filtros extra.
 */
const DECLARED: ExtraFilter[] =
  ((site as Record<string, unknown>).EXTRA_FILTERS as ExtraFilter[] | undefined) ?? [];

/** Filtros opcionales en uso. */
export const EXTRA_FILTERS: ExtraFilter[] = DECLARED.filter(
  (f) => VALID_ID.test(f.id) && f.key.trim() !== "",
);

/**
 * Los que se descartaron por un id inválido (con guion, espacios…) o sin
 * clave. La pestaña Setup los muestra: sin eso, el filtro desaparece sin
 * ningún error.
 */
export const INVALID_EXTRA_FILTERS: ExtraFilter[] = DECLARED.filter(
  (f) => !EXTRA_FILTERS.includes(f),
);

/** Etiqueta de un filtro en el idioma pedido. */
export const filterLabel = (filter: ExtraFilter, lang: Lang): string =>
  typeof filter.label === "string" ? filter.label : filter.label[lang];
