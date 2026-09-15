import type { QueryParams } from "./types";
import { ownership } from "../ownership";

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

/**
 * Cláusulas `| filter` para los selectores transversales tier/squad/tribu.
 * Deben insertarse DESPUÉS de tierLookupJoin y antes de cualquier summarize,
 * para que detalle y resumen filtren igual.
 */
export const tierFilterClause = (params?: QueryParams): string => {
  if (!params) return "";
  const clauses: string[] = [];
  if (params.tier) clauses.push(`| filter tier == "${escapeDql(params.tier)}"`);
  if (params.squad) clauses.push(`| filter squad == "${escapeDql(params.squad)}"`);
  if (params.tribu) clauses.push(`| filter tribu == "${escapeDql(params.tribu)}"`);
  if (params.cluster)
    clauses.push(`| filter k8s.cluster.name == "${escapeDql(params.cluster)}"`);
  return clauses.length ? `\n${clauses.join("\n")}` : "";
};

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
