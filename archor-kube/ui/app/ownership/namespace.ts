import type { OwnershipProvider } from "./types";
import { excludedNamespacesClause } from "../queries/namespaces";

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
  label: { en: "Namespace convention", es: "Convención de namespace" },
  about: {
    en: [
      "The namespace is taken as the owning team's name.",
      "It doesn't infer tier or domain: those stay empty, because deriving them",
      "from the namespace name would be guessing. Useful as a last resort when",
      "there are no labels or catalog.",
    ].join(" "),
    es: [
      "El namespace se toma como nombre del equipo dueño.",
      "No deduce tier ni dominio: esos quedan vacíos, porque derivarlos del",
      "nombre del namespace sería adivinar. Útil como último recurso cuando no",
      "hay labels ni catálogo.",
    ].join(" "),
  },

  enrich: (_sourceField, suffix = "") => {
    const s = suffix;
    return `| fieldsAdd tier${s} = null,
            squad${s} = \`k8s.namespace.name\`,
            tribu${s} = null,
            appCode${s} = null`;
  },

  // Los excluidos no son equipos: sin la exclusión, kube-system aparecería
  // como squad en el selector.
  filterOptions: `smartscapeNodes K8S_NAMESPACE
| fields k8s.namespace.name
${excludedNamespacesClause()}
| summarize n = count(), by:{squad = k8s.namespace.name}
| fields squad
| fieldsAdd tier = null, tribu = null
| sort squad asc`,

  catalog: null,
};
