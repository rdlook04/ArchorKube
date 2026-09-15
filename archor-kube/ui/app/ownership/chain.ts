import type { OwnershipProvider } from "./types";
import { OWNERSHIP_FIELDS } from "./types";
import { canonicalizeClause, sanitizeClause } from "./canonical";

/**
 * Encadena varios proveedores: gana el primero que resuelve cada campo.
 *
 * Esta es la parte que hace la app usable de verdad. Nadie llega con el 100 %
 * de sus workloads etiquetados, y una app que exige cobertura total no se usa.
 * La cadena típica va de lo más específico a lo más burdo:
 *
 *   chain(manualProvider(excepciones), labelsProvider, namespaceProvider)
 *
 * El coalesce es **por campo, no por proveedor**: un workload puede sacar el
 * squad de su label y el tier de una regla manual. Eso importa porque el caso
 * real más común es tener dueño pero no tier.
 *
 * Después del coalesce se normalizan los nombres, si alguna fuente sabe cuáles
 * son los canónicos (`canonicalNames`). Sin ese paso, encadenar dos fuentes que
 * escriben el mismo equipo distinto —`Data Ninjas` en un catálogo, `dataninjas` en
 * una label— lo parte en dos entradas en filtros y gráficas: se gana cobertura
 * y se rompe la dimensión, que es peor negocio. Ver `canonical.ts`.
 */
export const chainProviders = (
  ...providers: OwnershipProvider[]
): OwnershipProvider => {
  const active = providers.filter((p) => p.id !== "none");
  if (active.length === 0) {
    throw new Error("chainProviders necesita al menos un proveedor con datos");
  }
  // Incluso con un solo proveedor hay que sanear su salida: el marcador de
  // "sin asignar" puede venir de la propia fuente, no solo de encadenar.
  if (active.length === 1) {
    const only = active[0];
    return {
      ...only,
      enrich: (sourceField, suffix = "") =>
        `${only.enrich(sourceField, suffix)}
${sanitizeClause(suffix)}`,
    };
  }

  return {
    id: active.map((p) => p.id).join("+"),
    label: active.map((p) => p.label).join(" → "),
    about: [
      "Se consultan varias fuentes en orden y gana la primera que responde,",
      "campo por campo: un workload puede sacar el squad de una fuente y el",
      "tier de otra. Orden aplicado: ",
      active.map((p, i) => `${i + 1}) ${p.label}`).join(", "),
      ".",
    ].join(""),

    enrich: (sourceField, suffix = "") => {
      // Cada proveedor escribe en su propio juego de campos (_c0, _c1, …) y
      // recién al final se colapsan, para que ninguno pise al anterior.
      const parts = active.map((p, i) => {
        const sfx = `${suffix}_c${i}`;
        // El saneo va por proveedor y antes del coalesce: si el catálogo
        // responde "None" y la label trae el valor real, debe ganar la label.
        return `${p.enrich(sourceField, sfx)}
${sanitizeClause(sfx)}`;
      });
      const coalesced = OWNERSHIP_FIELDS.map((f) => {
        const args = active.map((_, i) => `${f}${suffix}_c${i}`).join(", ");
        return `${f}${suffix} = coalesce(${args})`;
      }).join(",\n            ");
      const scratch = active
        .flatMap((_, i) => OWNERSHIP_FIELDS.map((f) => `${f}${suffix}_c${i}`))
        .join(", ");

      // La normalización va DESPUÉS del coalesce: solo importa el valor que
      // termina viéndose, no los intermedios de cada proveedor.
      const canon = active.find((p) => p.canonicalNames)?.canonicalNames;
      const normalize = canon ? `\n${canonicalizeClause(canon, suffix)}` : "";

      return `${parts.join("\n")}
| fieldsAdd ${coalesced}
| fieldsRemove ${scratch}${normalize}`;
    },

    /**
     * Los selectores usan las opciones del primer proveedor que sepa
     * enumerarlas. Unir las de todos daría un desplegable más completo pero con
     * duplicados y sin forma de deduplicar sin ejecutar las dos consultas.
     */
    filterOptions: active.find((p) => p.filterOptions)?.filterOptions ?? "",

    /** El catálogo es el del primero que tenga inventario propio. */
    catalog: active.find((p) => p.catalog)?.catalog ?? null,

    /** Los nombres canónicos, de la primera fuente autoritativa de la cadena. */
    canonicalNames: active.find((p) => p.canonicalNames)?.canonicalNames,
  };
};
