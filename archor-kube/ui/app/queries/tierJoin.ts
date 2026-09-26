import type { QueryParams } from "./types";
import { ownership } from "../ownership";
import { EXTRA_FILTERS } from "../config/extraFilters";
import { excludedNamespacesClause } from "./namespaces";

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

const escapeDql = (value: string): string => value.replace(/["\\]/g, "");

/** Lectura de una clave de label del workload; las annotations ganan, como en el proveedor. */
const labelValue = (key: string, ann: string, lbl: string): string =>
  `coalesce(${ann}[\`${escapeDql(key)}\`], ${lbl}[\`${escapeDql(key)}\`])`;

/**
 * Filtros opcionales por label: solo se unen las labels del workload cuando
 * hay al menos uno elegido, así no cuestan nada mientras nadie los usa. La
 * fuente es la misma que la del proveedor de labels (cloud_application).
 */
const extraFilterClauses = (params: QueryParams, sourceField: string): string[] => {
  const chosen = EXTRA_FILTERS.filter((f) => params.extra?.[f.id]);
  if (chosen.length === 0) return [];
  return [
    `| lookup [
    fetch dt.entity.cloud_application
    | fields xf_wl = entity.name, xf_lbl = cloudApplicationLabels, xf_ann = kubernetesAnnotations
    | limit 10000
  ], sourceField:${sourceField}, lookupField:xf_wl, fields:{xf_lbl, xf_ann}`,
    ...chosen.map(
      (f) =>
        `| filter ${labelValue(f.key, "xf_ann", "xf_lbl")} == "${escapeDql(params.extra?.[f.id] ?? "")}"`,
    ),
    "| fieldsRemove xf_lbl, xf_ann",
  ];
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
export const extraFilterOptionsQuery = (key: string): string => `fetch dt.entity.cloud_application
| fields value = ${labelValue(key, "kubernetesAnnotations", "cloudApplicationLabels")}
| filter isNotNull(value) and value != ""
| summarize workloads = count(), by:{value}
| sort workloads desc
| limit 500`;

/** Opciones del selector de clúster (entidades K8s del environment). */
export const CLUSTER_FILTER_OPTIONS_QUERY = `fetch dt.entity.kubernetes_cluster
| fields cluster = entity.name
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
