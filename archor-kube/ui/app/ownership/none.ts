import type { OwnershipProvider } from "./types";

/**
 * Proveedor nulo: la app corre sin ninguna noción de propiedad.
 *
 * Existe para que ArchorKube sea útil desde el primer minuto en un cluster del
 * que no se sabe nada. Todos los módulos de análisis (M1–M11) funcionan igual;
 * lo único que se pierde es poder agrupar los hallazgos por equipo.
 *
 * Emite los campos del contrato en null en vez de omitirlos, para que ninguna
 * página tenga que ramificar entre "hay proveedor" y "no hay".
 */
export const noneProvider: OwnershipProvider = {
  id: "none",
  label: "Sin propiedad",
  about: [
    "No hay fuente de propiedad configurada: los hallazgos se muestran sin",
    "agrupar por equipo. Todos los análisis funcionan igual; solo se pierde la",
    "priorización por tier.",
  ].join(" "),

  enrich: (_sourceField, suffix = "") => {
    const s = suffix;
    return `| fieldsAdd tier${s} = null, squad${s} = null, tribu${s} = null, appCode${s} = null`;
  },

  filterOptions: "",
  catalog: null,
};
