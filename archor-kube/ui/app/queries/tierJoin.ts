import type { QueryParams } from "./types";
import { ownership } from "../ownership";
import { EXTRA_FILTERS, type ExtraFilter, isNamespaceScoped } from "../config/extraFilters";
import { excludedNamespacesClause } from "./namespaces";
import {
  WORKLOAD_ANNOTATIONS,
  WORKLOAD_LABELS,
  WORKLOAD_NAME,
  WORKLOAD_NODES,
} from "./workloads";

/**
 * Puente entre los módulos de análisis y la capa de propiedad.
 *
 * Los módulos M1–M11 importan de aquí y no saben —ni deben saber— de dónde
 * sale el tier: si viene de labels de Kubernetes, de un catálogo externo o de
 * un mapeo a mano es decisión de `ui/app/ownership/active.ts`. Gracias a eso,
 * cambiar de fuente no toca ninguna consulta de análisis.
 */

/**
 * Fragmento DQL que enriquece cualquier resultado con `tier`, `squad`, `tribu`
 * y `appCode`. `sourceField` debe contener el nombre del workload/contenedor.
 * Los campos siempre quedan definidos: null cuando no se conoce el dueño.
 */
export const tierLookupJoin = (sourceField: string): string =>
  ownership.enrich(sourceField);

export const escapeDql = (value: string): string => value.replace(/["\\]/g, "");

/** Lectura de una clave de label del workload; las annotations ganan, como en el proveedor. */
export const labelValue = (key: string, ann: string, lbl: string): string =>
  `coalesce(${ann}[\`${escapeDql(key)}\`], ${lbl}[\`${escapeDql(key)}\`])`;

/**
 * Une las labels y annotations del workload con los nombres de campo pedidos.
 * La fuente es la misma que la del proveedor de labels (`workloads.ts`).
 */
export const workloadLabelsLookup = (sourceField: string, ann: string, lbl: string): string =>
  `| lookup [
    ${WORKLOAD_NODES}
    | fields ${ann}_wl = ${WORKLOAD_NAME}, ${lbl} = ${WORKLOAD_LABELS}, ${ann} = ${WORKLOAD_ANNOTATIONS}
    | limit 10000
  ], sourceField:${sourceField}, lookupField:${ann}_wl, fields:{${lbl}, ${ann}}`;

/**
 * Une las labels y annotations del namespace de cada fila. La clave es
 * clúster + nombre: el mismo namespace puede existir en varios clústeres con
 * labels distintas.
 */
const namespaceLabelsLookup = (prefix: string): string =>
  `| fieldsAdd ${prefix}_key = concat(k8s.cluster.name, "/", k8s.namespace.name)
| lookup [
    smartscapeNodes K8S_NAMESPACE
    | fields ${prefix}_key = concat(k8s.cluster.name, "/", k8s.namespace.name), ${prefix}_lbl = \`tags:k8s.labels\`, ${prefix}_ann = \`tags:k8s.annotations\`
  ], sourceField:${prefix}_key, lookupField:${prefix}_key, fields:{${prefix}_lbl, ${prefix}_ann}`;

/**
 * Cómo leer un filtro opcional en DQL: la unión que trae sus labels (del
 * workload o de su namespace), la expresión con su valor y la limpieza de los
 * campos auxiliares. `prefix` evita choques cuando se unen varias veces.
 */
export const labelSource = (
  filter: ExtraFilter,
  sourceField: string,
  prefix: string,
): { lookup: string; value: string; cleanup: string } =>
  isNamespaceScoped(filter)
    ? {
        lookup: namespaceLabelsLookup(prefix),
        value: labelValue(filter.key, `${prefix}_ann`, `${prefix}_lbl`),
        cleanup: `| fieldsRemove ${prefix}_key, ${prefix}_lbl, ${prefix}_ann`,
      }
    : {
        lookup: workloadLabelsLookup(sourceField, `${prefix}_ann`, `${prefix}_lbl`),
        value: labelValue(filter.key, `${prefix}_ann`, `${prefix}_lbl`),
        cleanup: `| fieldsRemove ${prefix}_lbl, ${prefix}_ann`,
      };

/**
 * Filtros opcionales por label: las labels solo se unen cuando hay al menos
 * un filtro elegido, así no cuestan nada mientras nadie los usa. Una unión
 * por fuente (workload, namespace), no una por filtro.
 */
const extraFilterClauses = (params: QueryParams, sourceField: string): string[] => {
  const chosen = EXTRA_FILTERS.filter((f) => params.extra?.[f.id]);
  const groups = [
    { prefix: "xf", filters: chosen.filter((f) => !isNamespaceScoped(f)) },
    { prefix: "xn", filters: chosen.filter(isNamespaceScoped) },
  ];
  return groups.flatMap(({ prefix, filters }) => {
    if (filters.length === 0) return [];
    const { lookup, cleanup } = labelSource(filters[0], sourceField, prefix);
    return [
      lookup,
      ...filters.map(
        (f) =>
          `| filter ${labelSource(f, sourceField, prefix).value} == "${escapeDql(params.extra?.[f.id] ?? "")}"`,
      ),
      cleanup,
    ];
  });
};

/**
 * Cláusulas `| filter` para los selectores transversales. Deben insertarse
 * DESPUÉS de tierLookupJoin y antes de cualquier summarize, para que detalle
 * y resumen filtren igual.
 *
 * `sourceField` es el campo que trae el nombre del workload en esa consulta
 * (el mismo que recibe tierLookupJoin); solo lo usan los filtros por label.
 */
export const tierFilterClause = (
  params?: QueryParams,
  sourceField = "k8s.workload.name",
): string => {
  if (!params) return "";
  const clauses: string[] = [];
  if (params.tier) clauses.push(`| filter tier == "${escapeDql(params.tier)}"`);
  if (params.squad) clauses.push(`| filter squad == "${escapeDql(params.squad)}"`);
  if (params.tribu) clauses.push(`| filter tribu == "${escapeDql(params.tribu)}"`);
  if (params.cluster)
    clauses.push(`| filter k8s.cluster.name == "${escapeDql(params.cluster)}"`);
  if (params.namespace)
    clauses.push(`| filter k8s.namespace.name == "${escapeDql(params.namespace)}"`);
  clauses.push(...extraFilterClauses(params, sourceField));
  return clauses.length ? `\n${clauses.join("\n")}` : "";
};

/**
 * Opciones del selector de namespace, con su clúster para poder acotarlas.
 * Excluye los mismos namespaces que los módulos.
 */
export const NAMESPACE_FILTER_OPTIONS_QUERY = `smartscapeNodes K8S_NAMESPACE
| fields k8s.namespace.name, k8s.cluster.name
${excludedNamespacesClause()}
| fields namespace = k8s.namespace.name, cluster = k8s.cluster.name
| limit 10000`;

/** Valores de una label opcional; sin filas = la clave no existe y el filtro se esconde. */
export const extraFilterOptionsQuery = (filter: ExtraFilter): string =>
  isNamespaceScoped(filter)
    ? `smartscapeNodes K8S_NAMESPACE
| fields value = ${labelValue(filter.key, "`tags:k8s.annotations`", "`tags:k8s.labels`")}
| filter isNotNull(value) and value != ""
| summarize n = count(), by:{value}
| sort n desc
| limit 500`
    : `${WORKLOAD_NODES}
| fields value = ${labelValue(filter.key, WORKLOAD_ANNOTATIONS, WORKLOAD_LABELS)}
| filter isNotNull(value) and value != ""
| summarize n = count(), by:{value}
| sort n desc
| limit 500`;

/** Opciones del selector de clúster (los clústeres K8s de Smartscape). */
export const CLUSTER_FILTER_OPTIONS_QUERY = `smartscapeNodes K8S_CLUSTER
| summarize n = count(), by:{cluster = name}
| fields cluster
| sort cluster asc`;

/**
 * Opciones de los selectores tier/squad/tribu, según el proveedor activo.
 * Vacío cuando el proveedor no puede enumerarlas por adelantado: la UI se
 * apoya en eso para esconder los selectores en vez de mostrarlos sin opciones.
 */
export const TIER_FILTER_OPTIONS_QUERY = ownership.filterOptions;

/** Si hay selectores que mostrar con el proveedor activo. */
export const HAS_TIER_FILTERS = TIER_FILTER_OPTIONS_QUERY !== "";

/** Texto de procedencia para el panel "de dónde salen estos datos". */
export const OWNERSHIP_ABOUT = ownership.about;
