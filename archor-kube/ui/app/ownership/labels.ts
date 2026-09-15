import type { OwnershipProvider } from "./types";
import { OWNERSHIP_KEYS } from "../config/site";
import { IGNORED_DQL } from "./canonical";

/**
 * Proveedor por labels/annotations de Kubernetes. Es el default público: no
 * exige ningún catálogo externo, solo que los workloads estén etiquetados.
 *
 * Convención: se apoya en las labels recomendadas de Kubernetes donde existen
 * (`app.kubernetes.io/part-of` para la aplicación) y agrega las propias para lo
 * que el estándar no cubre (tier, squad, dominio):
 *
 *   metadata:
 *     labels:
 *       app.kubernetes.io/name: checkout-api
 *       app.kubernetes.io/part-of: payments
 *       archorkube.io/tier: "1"
 *       archorkube.io/owner: squad-payments
 *       archorkube.io/domain: commerce
 *
 * Las annotations ganan sobre las labels: permiten sobrescribir un workload
 * puntual sin tocar los selectores del Deployment (las labels de un pod
 * template son inmutables en algunos controladores; las annotations no).
 */

/**
 * Las claves viven en `config/site.ts` porque son de cada organizacion, no del
 * proyecto: quien use este repo casi seguro ya tiene su propia convencion.
 * Se re-exportan aca para que el resto de la app las tome del proveedor y no
 * tenga que saber donde estan configuradas.
 */
export { OWNERSHIP_KEYS };

/**
 * De dónde se leen labels y annotations en Grail.
 *
 * Los nombres verificados contra un tenant real (2026-08-24) son
 * `cloudApplicationLabels` y `kubernetesAnnotations`. Ojo: NO es
 * `kubernetesLabels` — ese campo no existe y usarlo hace fallar la consulta
 * entera, no solo el enriquecimiento.
 *
 * Aun así, confírmalo en el tuyo antes de activarlo: qué propiedades de entidad
 * existen depende de la versión del operador y de qué esté configurado para
 * ingerirse. `describe dt.entity.cloud_application` las lista todas.
 *
 * Si las labels no llegan, usa el proveedor `manual` o `namespace`: la app no
 * puede inventarlas.
 */
const SOURCE = {
  entityType: "dt.entity.cloud_application",
  nameField: "entity.name",
  labelsField: "cloudApplicationLabels",
  annotationsField: "kubernetesAnnotations",
} as const;


/**
 * `coalesce(annotations["k"], labels["k"])` para una clave de la convención,
 * descartando los valores que significan "sin asignar".
 *
 * El descarte va por dentro del coalesce a propósito: si la annotation trae
 * `""` y la label trae el squad de verdad, debe ganar la label. Filtrando por
 * fuera, el vacío de la annotation se comería la respuesta buena.
 */
const readKey = (key: string, sfx: string): string => {
  const pick = (src: string) =>
    `if(in(lower(${src}${sfx}[\`${key}\`]), ${IGNORED_DQL}), null, else: ${src}${sfx}[\`${key}\`])`;
  return `coalesce(${pick("ann")}, ${pick("lbl")})`;
};

export const labelsProvider: OwnershipProvider = {
  id: "labels",
  label: "Labels / annotations de Kubernetes",
  about: [
    "La propiedad se lee de las labels y annotations del propio workload",
    `(\`${OWNERSHIP_KEYS.squad}\`, \`${OWNERSHIP_KEYS.tier}\`).`,
    "Las annotations ganan sobre las labels. Un workload sin etiquetar aparece",
    "como *(sin dueño)* — no se le asigna uno por defecto, porque un dueño",
    "inventado es peor que un hueco visible.",
  ].join(" "),

  enrich: (sourceField, suffix = "") => {
    const s = suffix;
    return `| lookup [
    fetch ${SOURCE.entityType}
    | fields wl${s} = ${SOURCE.nameField}, lbl${s} = ${SOURCE.labelsField}, ann${s} = ${SOURCE.annotationsField}
    | limit 10000
  ], sourceField:${sourceField}, lookupField:wl${s}, fields:{lbl${s}, ann${s}}
| fieldsAdd tier${s} = ${readKey(OWNERSHIP_KEYS.tier, s)},
            squad${s} = ${readKey(OWNERSHIP_KEYS.squad, s)},
            tribu${s} = ${readKey(OWNERSHIP_KEYS.tribu, s)},
            appCode${s} = ${readKey(OWNERSHIP_KEYS.appCode, s)}
| fieldsRemove lbl${s}, ann${s}`;
  },

  /**
   * Los selectores se arman con los valores que realmente existen en el
   * cluster: si nadie usó tier 3, tier 3 no aparece en el desplegable.
   */
  filterOptions: `fetch ${SOURCE.entityType}
| fields lbl = ${SOURCE.labelsField}, ann = ${SOURCE.annotationsField}
| fieldsAdd tier = ${readKey(OWNERSHIP_KEYS.tier, "")},
            squad = ${readKey(OWNERSHIP_KEYS.squad, "")},
            tribu = ${readKey(OWNERSHIP_KEYS.tribu, "")}
| filter isNotNull(squad)
| summarize workloads = count(), by:{squad, tier, tribu}
| sort squad asc`,

  /**
   * El inventario es el conjunto de workloads etiquetados. Incluye a propósito
   * los que NO tienen dueño: esa fila es el hallazgo más accionable de la
   * página, no un error de la consulta.
   */
  catalog: `fetch ${SOURCE.entityType}
| fields repo = ${SOURCE.nameField}, lbl = ${SOURCE.labelsField}, ann = ${SOURCE.annotationsField}
| fieldsAdd tier = ${readKey(OWNERSHIP_KEYS.tier, "")},
            squad = ${readKey(OWNERSHIP_KEYS.squad, "")},
            domain = ${readKey(OWNERSHIP_KEYS.tribu, "")},
            application = ${readKey(OWNERSHIP_KEYS.appCode, "")}
| fields repo, application, squad, tier, domain
| limit 10000`,
};
