import { OWNERSHIP_IGNORED_VALUES } from "../config/site";
import { OWNERSHIP_FIELDS } from "./types";

/**
 * Normalización de nombres entre fuentes de propiedad.
 *
 * El problema que resuelve: dos fuentes pueden nombrar al mismo equipo de forma
 * distinta. Un catálogo suele guardar el nombre de display (`Data Ninjas`,
 * `Equipo Facturación`) y una label de Kubernetes guarda el slug (`dataninjas`,
 * `equipofacturacion`), porque las labels no admiten espacios ni acentos.
 *
 * Si se encadenan sin normalizar, el mismo squad aparece **dos veces** en los
 * filtros, las gráficas y los agrupados: una por cada fuente que lo resolvió.
 * Se gana cobertura y se rompe la dimensión, que es peor negocio.
 *
 * La solución no es comparar en minúsculas y ya: hay que **devolver siempre el
 * nombre de display**, porque es el que la gente reconoce. Para eso se usa el
 * catálogo como diccionario: se sluggifica su nombre canónico, se busca por ahí
 * el valor que trajo la label, y se reemplaza por el canónico. Lo que no está
 * en el diccionario se queda con el valor crudo — un equipo que solo existe en
 * las labels debe verse igual, no desaparecer.
 */

/** Acentos y diéresis que las labels de Kubernetes no pueden llevar. */
const ACCENTS: ReadonlyArray<readonly [string, string]> = [
  ["á", "a"],
  ["é", "e"],
  ["í", "i"],
  ["ó", "o"],
  ["ú", "u"],
  ["ü", "u"],
  ["ñ", "n"],
];

/** Separadores que cada fuente pone o quita a su gusto. */
const SEPARATORS = [" ", "-", "_", "."];

/**
 * Expresión DQL que reduce un nombre a su forma comparable: minúsculas, sin
 * acentos y sin separadores. `Data Ninjas` y `dataninjas` colapsan a `dataninjas`.
 *
 * Se construye anidando `replaceString` porque DQL no trae una función de
 * normalización. Son ~11 llamadas anidadas sobre un campo ya materializado, no
 * sobre la fuente, así que el costo es despreciable frente a los lookups.
 */
export const slugExpr = (field: string): string =>
  [...ACCENTS, ...SEPARATORS.map((s) => [s, ""] as const)].reduce(
    (expr, [from, to]) => `replaceString(${expr}, "${from}", "${to}")`,
    `lower(${field})`,
  );

/**
 * Cláusula DQL que traduce `squad` y `tribu` a sus nombres canónicos.
 *
 * `canonicalNames` debe ser una consulta que devuelva `squad_canon` y
 * `tribu_canon` — la lista autoritativa de equipos y dominios. Conviene que sea
 * la consulta más barata que los liste (la tabla de equipos, no el inventario
 * entero de servicios): se ejecuta una vez por cada consulta de módulo.
 *
 * Los campos que no matchean quedan como estaban, nunca en null: perder un
 * dueño por no estar en el diccionario sería peor que mostrarlo sin normalizar.
 */
export const canonicalizeClause = (
  canonicalNames: string,
  suffix = "",
): string => {
  const s = suffix;
  // `summarize` en DQL exige al menos una funcion de agregacion: la forma
  // `summarize by:{...}` sola es un error de sintaxis, no un dedup. El count
  // no se usa para nada, solo cumple ese requisito.
  const dict = (field: string) => `[
    ${canonicalNames}
    | filter isNotNull(${field})
    | fieldsAdd k = ${slugExpr(field)}
    | summarize filas = count(), by:{k, ${field}}
  ]`;

  return `| fieldsAdd sq_key${s} = ${slugExpr(`squad${s}`)},
            tr_key${s} = ${slugExpr(`tribu${s}`)}
| lookup ${dict("squad_canon")}, sourceField:sq_key${s}, lookupField:k, fields:{sq_canon${s} = squad_canon}
| lookup ${dict("tribu_canon")}, sourceField:tr_key${s}, lookupField:k, fields:{tr_canon${s} = tribu_canon}
| fieldsAdd squad${s} = coalesce(sq_canon${s}, squad${s}),
            tribu${s} = coalesce(tr_canon${s}, tribu${s})
| fieldsRemove sq_key${s}, tr_key${s}, sq_canon${s}, tr_canon${s}`;
};

/** Lista DQL de valores que significan "sin asignar", en minusculas. */
export const IGNORED_DQL = `{${OWNERSHIP_IGNORED_VALUES.map(
  (v) => `"${v.toLowerCase().split('"').join("")}"`,
).join(", ")}}`;

/**
 * Anula los valores que significan "sin asignar" en la salida de un proveedor.
 *
 * Va por proveedor y ANTES del coalesce, no al final: si el catalogo responde
 * el string "None" y una label trae el tier de verdad, debe ganar la label. Un
 * saneo posterior al coalesce dejaria el hueco igual, porque "None" ya se
 * habria comido el turno.
 *
 * Aplica a cualquier fuente, no solo a las labels: el marcador de "sin
 * asignar" tambien aparece en catalogos. Un tier falso es mas caro que un
 * hueco — el hueco se ve y se corrige, el falso ordena mal la cola.
 */
export const sanitizeClause = (suffix = ""): string =>
  `| fieldsAdd ${OWNERSHIP_FIELDS.map(
    (f) =>
      `${f}${suffix} = if(in(lower(${f}${suffix}), ${IGNORED_DQL}), null, else: ${f}${suffix})`,
  ).join(",\n            ")}`;
