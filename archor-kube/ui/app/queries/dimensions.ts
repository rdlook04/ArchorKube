import { EXTRA_FILTERS, filterLabel } from "../config/extraFilters";
import type { Lang } from "../i18n";
import { noneLabel } from "./lang";
import { escapeDql, labelValue, workloadLabelsLookup } from "./tierJoin";
import type { QueryParams } from "./types";

/**
 * Ejes de las gráficas de los módulos: por qué se agrupan las barras.
 *
 * Los mismos cortes que los filtros de arriba: propiedad (tier, squad, tribu),
 * dónde corre (cluster, namespace) y cada filtro opcional de `site.ts`
 * (business-criticality, entorno…). Filtrar recorta; agrupar compara, y un
 * filtro que sirve para recortar casi siempre sirve también como eje.
 *
 * Las labels se unen solo cuando el eje elegido es una label, igual que los
 * filtros: mientras nadie las usa, no cuestan nada.
 */
export type ChartDimension = "tier" | "squad" | "tribu" | "cluster" | "namespace" | `label:${string}`;

/** Ejes disponibles en todas las gráficas, en el orden del selector. */
export const CHART_DIMENSIONS: ChartDimension[] = [
  "tier",
  "squad",
  "tribu",
  "cluster",
  "namespace",
  ...EXTRA_FILTERS.map((f): ChartDimension => `label:${f.id}`),
];

const labelFilter = (dimension: string) =>
  dimension.startsWith("label:")
    ? EXTRA_FILTERS.find((f) => `label:${f.id}` === dimension)
    : undefined;

/** Nombre visible de un eje que viene de `site.ts`; undefined para los fijos. */
export const labelDimensionName = (dimension: string, lang: Lang): string | undefined => {
  const filter = labelFilter(dimension);
  return filter ? filterLabel(filter, lang) : undefined;
};

const FIELDS: Record<"tier" | "squad" | "tribu" | "cluster" | "namespace", string> = {
  tier: "tier",
  squad: "squad",
  tribu: "tribu",
  cluster: "k8s.cluster.name",
  namespace: "k8s.namespace.name",
};

/**
 * Agrega el campo `category` con el valor del eje, o "(sin …)" si la fila no
 * lo tiene. Va después del build del módulo y antes del summarize.
 *
 * `sourceField` es el campo con el nombre del workload en esa consulta (el
 * mismo que recibe tierLookupJoin); solo lo usan los ejes por label.
 */
export const categoryClause = (
  dimension: ChartDimension,
  params: QueryParams | undefined,
  sourceField = "k8s.workload.name",
): string => {
  const filter = labelFilter(dimension);
  if (filter) {
    const none = escapeDql(noneLabel(filterLabel(filter, params?.lang ?? "en").toLowerCase(), params));
    return `
${workloadLabelsLookup(sourceField, "xd_ann", "xd_lbl")}
| fieldsAdd category = coalesce(${labelValue(filter.key, "xd_ann", "xd_lbl")}, "${none}")
| fieldsRemove xd_lbl, xd_ann`;
  }
  const field = FIELDS[dimension as keyof typeof FIELDS] ?? "tier";
  return `
| fieldsAdd category = coalesce(${field}, "${noneLabel(dimension, params)}")`;
};
