import type { OwnershipProvider } from "./types";

/**
 * Proveedor por convención de namespace: el namespace ES el equipo.
 *
 * Es el más burdo de los cuatro y a la vez el que más veces acierta en clusters
 * sin gobierno, donde nadie etiquetó nada pero cada equipo tiene su namespace.
 * No puede deducir tier ni dominio — solo dueño — y eso es correcto: inventar
 * un tier a partir del nombre de un namespace sería adivinar.
 *
 * Pensado sobre todo como último eslabón de una cadena (ver `chain.ts`), para
 * que un workload sin labels al menos caiga en algún equipo en vez de en el
 * cubo de "sin dueño".
 */
export const namespaceProvider: OwnershipProvider = {
  id: "namespace",
  label: "Convención de namespace",
  about: [
    "El namespace se toma como nombre del equipo dueño.",
    "No deduce tier ni dominio: esos quedan vacíos, porque derivarlos del",
    "nombre del namespace sería adivinar. Útil como último recurso cuando no",
    "hay labels ni catálogo.",
  ].join(" "),

  enrich: (_sourceField, suffix = "") => {
    const s = suffix;
    return `| fieldsAdd tier${s} = null,
            squad${s} = \`k8s.namespace.name\`,
            tribu${s} = null,
            appCode${s} = null`;
  },

  filterOptions: `fetch dt.entity.cloud_application_namespace
| fields squad = entity.name
| fieldsAdd tier = null, tribu = null
| sort squad asc`,

  catalog: null,
};
