import type { Lang } from "../i18n";
import { LIST_PRICES, type ListPriceTable, type PriceBase } from "./listPrices";
import * as site from "./site";
import { LOOKUP_PATHS, hasLookup } from "../templates/lookups";

/**
 * Qué precio por hora tiene cada tipo de instancia.
 *
 * Tres capas, de la que más gana a la que menos:
 *  1. `INSTANCE_HOURLY_USD` en `site.ts` (precios propios en código);
 *  2. la tabla de precios subida a Grail desde Setup (`PRICE_TABLE`);
 *  3. la base de lista de la nube elegida (`PRICE_BASE`, tabla generada en
 *     `listPrices.ts`).
 * Un cluster on-premise o un contrato con descuento usa las propias
 * (`PRICE_BASE = "none"`).
 *
 * `PRICE_BASE` se lee de forma tolerante: un `site.ts` copiado antes de que
 * existiera sigue compilando y funciona como antes, solo con precios propios.
 */
const declared = (site as Record<string, unknown>).PRICE_BASE as PriceBase | undefined;

export const PRICE_BASE: PriceBase =
  declared === "azure" || declared === "aws" || declared === "gcp" ? declared : "none";

/** La tabla de lista en uso, o null si no hay base. */
export const LIST_BASE: ListPriceTable | null =
  PRICE_BASE === "none" ? null : LIST_PRICES[PRICE_BASE];

/** Precios propios, los de `INSTANCE_HOURLY_USD`. */
export const OWN_PRICES: Record<string, number> = site.INSTANCE_HOURLY_USD;

/** La tabla de precios de Grail, si fue subida. Sus precios solo se conocen en DQL. */
export const PRICE_TABLE: string | null = hasLookup("prices") ? LOOKUP_PATHS.prices : null;

/**
 * Precio conocido en código por tipo de instancia: lista de la base, pisada por
 * los propios. No incluye la tabla de Grail (ver `PRICE_TABLE`).
 */
export const HOURLY_USD: Record<string, number> = { ...(LIST_BASE?.prices ?? {}), ...OWN_PRICES };

/** De qué base de lista sale un tipo de instancia, si está en alguna. */
export const listBaseOf = (instanceType: string): PriceBase | null =>
  (Object.keys(LIST_PRICES) as Exclude<PriceBase, "none">[]).find(
    (base) => instanceType in LIST_PRICES[base].prices,
  ) ?? null;

/** De dónde salen los precios, en palabras, para mostrarlo junto a las cifras. */
export const pricingSource = (lang: Lang): string => {
  const own = Object.keys(OWN_PRICES).length;
  const parts: string[] = [];
  if (own > 0) {
    parts.push(
      lang === "es"
        ? `${site.PRICING_SOURCE} (${own} tipo(s) con precio propio)`
        : `${site.PRICING_SOURCE} (${own} type(s) with your own price)`,
    );
  }
  if (PRICE_TABLE) {
    parts.push(
      lang === "es"
        ? `tabla de precios de Grail (${PRICE_TABLE})`
        : `Grail price table (${PRICE_TABLE})`,
    );
  }
  if (LIST_BASE) parts.push(LIST_BASE.source[lang]);
  if (parts.length === 0) {
    return lang === "es"
      ? "No hay precios configurados (tabla de precios en Setup, o PRICE_BASE / INSTANCE_HOURLY_USD en site.ts)"
      : "No prices configured (price table in Setup, or PRICE_BASE / INSTANCE_HOURLY_USD in site.ts)";
  }
  return parts.join(lang === "es" ? "; el resto, " : "; the rest, ");
};
