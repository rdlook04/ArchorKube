import type { QueryParams } from "./types";

/**
 * Textos que produce el propio DQL (motivos, categorías de "sin dato"). Se
 * eligen al armar la consulta según `params.lang`; sin idioma, inglés, que es
 * el idioma por defecto de la app. Los códigos (OCIOSO_CONFIRMADO…) no pasan
 * por aquí: son el contrato de las consultas y no se traducen.
 */
export const qx = (params: QueryParams | undefined, en: string, es: string): string =>
  params?.lang === "es" ? es : en;

/** Categoría de la gráfica cuando la fila no tiene valor en esa dimensión. */
export const noneLabel = (dimension: string, params?: QueryParams): string =>
  qx(params, `(no ${dimension === "tribu" ? "tribe" : dimension})`, `(sin ${dimension})`);
