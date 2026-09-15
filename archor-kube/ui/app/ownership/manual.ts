import type { OwnershipProvider } from "./types";
import { noneProvider } from "./none";

/**
 * Proveedor por mapeo manual. Funciona para todo el mundo, incluido quien no
 * etiqueta nada y no tiene catálogo: se declaran las reglas aquí (o se editan
 * en Settings y se persisten en App State) y la app las compila a DQL.
 *
 * Es también la vía de **excepciones**: sirve para corregir a mano lo que el
 * proveedor principal resuelve mal, encadenándolo delante (ver `chain.ts`).
 *
 * Escala hasta unas pocas cientas de reglas. El DQL resultante es una cadena de
 * `if()`, así que con miles de entradas conviene un lookup en Grail
 * (`csvProvider`) en vez de esto.
 */

export interface OwnershipRule {
  /** Nombre exacto del workload/contenedor, o prefijo si `prefix` es true. */
  match: string;
  /** Trata `match` como prefijo en vez de igualdad exacta. */
  prefix?: boolean;
  squad: string;
  tier?: string;
  tribu?: string;
  appCode?: string;
}

/**
 * Reglas por defecto: vacío a propósito. Un ejemplo hardcodeado aquí acabaría
 * copiado a producción por alguien, y un dueño equivocado es peor que ninguno.
 *
 *   export const DEFAULT_RULES: OwnershipRule[] = [
 *     { match: "checkout-", prefix: true, squad: "squad-payments", tier: "1" },
 *     { match: "batch-reconcile", squad: "squad-finops", tier: "3" },
 *   ];
 */
export const DEFAULT_RULES: OwnershipRule[] = [];

const esc = (v: string): string => v.replace(/["\\]/g, "");

/** Condición DQL de una regla: igualdad exacta o prefijo. */
const condition = (rule: OwnershipRule, src: string): string =>
  rule.prefix
    ? `startsWith(${src}, "${esc(rule.match)}")`
    : `${src} == "${esc(rule.match)}"`;

/** Valor literal o `null` cuando la regla no define ese campo. */
const literal = (v: string | undefined): string => (v ? `"${esc(v)}"` : "null");

/**
 * Compila las reglas a un `if()` anidado por campo. Sin reglas devuelve `null`
 * literal, para que el campo exista igual y las páginas no tengan que
 * distinguir "no configurado" de "sin dueño".
 */
const chainFor = (
  rules: OwnershipRule[],
  src: string,
  pick: (r: OwnershipRule) => string | undefined,
): string => {
  if (rules.length === 0) return "null";
  const body = rules
    .map((r) => `${condition(r, src)}, ${literal(pick(r))}`)
    .join(", else: if(");
  return `if(${body}, else: null${")".repeat(rules.length)}`;
};

export const manualProvider = (
  rules: OwnershipRule[] = DEFAULT_RULES,
): OwnershipProvider =>
  // Un proveedor manual sin reglas no resuelve nada, así que se declara como
  // `none`: `chainProviders` descarta esos y así no se emiten cuatro campos
  // null que luego habría que coalescer para nada.
  rules.length === 0 ? noneProvider : {
  id: "manual",
  label: "Mapeo manual",
  about: [
    `Reglas declaradas en la configuración de la app (${rules.length} activa(s)).`,
    "Se evalúan en orden y gana la primera que coincide, así que las reglas más",
    "específicas deben ir arriba. Lo que ninguna regla cubre queda *(sin dueño)*.",
  ].join(" "),

  enrich: (sourceField, suffix = "") => {
    const s = suffix;
    return `| fieldsAdd tier${s} = ${chainFor(rules, sourceField, (r) => r.tier)},
            squad${s} = ${chainFor(rules, sourceField, (r) => r.squad)},
            tribu${s} = ${chainFor(rules, sourceField, (r) => r.tribu)},
            appCode${s} = ${chainFor(rules, sourceField, (r) => r.appCode)}`;
  },

  /**
   * Las opciones salen de las propias reglas, no de una consulta: ya sabemos
   * todos los valores posibles sin ir a Grail. `data record(...)` construye la
   * tabla en el motor.
   */
  filterOptions:
    rules.length === 0
      ? ""
      : `data record(${rules
          .map(
            (r) =>
              `squad = "${esc(r.squad)}", tier = ${literal(r.tier)}, tribu = ${literal(r.tribu)}`,
          )
          .join("), record(")})
| summarize reglas = count(), by:{squad, tier, tribu}
| sort squad asc`,

  catalog: null,
};
