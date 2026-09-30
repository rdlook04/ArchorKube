import type { Lang } from "../i18n";
import { LIST_PRICES, type ListPriceTable, type PriceBase } from "./listPrices";
import * as site from "./site";

/**
 * Qué precio por hora tiene cada tipo de instancia.
 *
 * Dos capas: una base de precios de lista de la nube elegida (`PRICE_BASE`
 * en `site.ts`, tabla generada en `listPrices.ts`) y encima los precios
 * propios de `INSTANCE_HOURLY_USD`, que ganan siempre. Un cluster on-premise
 * o un contrato con descuento usa solo la capa propia (`PRICE_BASE = "none"`).
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

/** Precio efectivo por tipo de instancia: lista de la base, pisada por los propios. */
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
  if (LIST_BASE) parts.push(LIST_BASE.source[lang]);
  if (parts.length === 0) {
    return lang === "es"
      ? "No hay precios configurados (PRICE_BASE o INSTANCE_HOURLY_USD en site.ts)"
      : "No prices configured (PRICE_BASE or INSTANCE_HOURLY_USD in site.ts)";
  }
  return parts.join(lang === "es" ? "; el resto, " : "; the rest, ");
};
