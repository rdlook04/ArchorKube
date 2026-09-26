import type { QueryDef, QueryParams } from "./types";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { rangeWindow } from "./analysisWindow";

/**
 * M9 — Errores críticos (SPEC §4).
 * Logs con nivel ERROR/CRITICAL/EMERGENCY en 24h agrupados por contenedor.
 * Nota: en los logs de este environment k8s.workload.name viene null; el
 * agrupador correcto es k8s.container.name (que además hace match con el
 * catálogo de propiedad para el tier). Validado: ~1.9M ERROR + 32k CRITICAL en 6h.
 *
 * v2 (molde M3, 2026-07-14): `severidad` (con/sin críticos) para color y
 * gráfica + join tier/squad/tribu compartido + filtros transversales.
 * El filtro se aplica sobre el top-300 más ruidoso (limit antes del lookup por
 * performance), así resumen y detalle quedan consistentes. Sin deep link
 * (los logs no traen workload id) ni USD (los errores no son costo directo).
 */
export const criticalErrors: QueryDef = {
  id: "errors.critical",
  module: "critical-errors",
  title: { en: "Log errors by container (24h)", es: "Errores en logs por contenedor (24h)" },
  description:
    { en: "Containers with the most errors and criticals in their logs, with tier and squad", es: "Contenedores con más errores y críticos en logs, con tier y squad" },
  window: rangeWindow(24,
    { en: "Logs at ERROR level or above over the last 24 hours.", es: "Logs con nivel ERROR o superior de las últimas 24 horas." },
  ),
  build: (params?: QueryParams) => `fetch logs, from: now()-24h
| filter in(loglevel, {"ERROR", "CRITICAL", "EMERGENCY", "SEVERE", "FATAL"})
| filter isNotNull(k8s.container.name)
| summarize
    errores   = count(),
    criticos  = countIf(loglevel != "ERROR"),
    by: {k8s.container.name, k8s.namespace.name, k8s.cluster.name}
| sort criticos desc, errores desc
| limit 300
${tierLookupJoin("k8s.container.name")}${tierFilterClause(params, "k8s.container.name")}
| fieldsAdd severidad = if(criticos > 0, "CON_CRITICOS", else: "SOLO_ERRORES")
| fieldsAdd prioridad = if(criticos > 0, 1, else: 2)
| sort prioridad asc, criticos desc, errores desc
| fields k8s.cluster.name, k8s.namespace.name, k8s.container.name,
    tier, squad, tribu, appCode, severidad, prioridad, errores, criticos`,
};

/** Dimensión del eje de la gráfica categórica de severidad. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de contenedores por severidad agrupado por una dimensión.
 * Alimenta el CategoricalBarChart apilado del resumen.
 */
export const errorSeverityBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${criticalErrors.build(params)}
| summarize contenedores = count(), by:{ category = coalesce(${dimension}, "(sin ${dimension})"), severidad }
| sort category asc`;

/** Resumen ejecutivo: errores por tier. */
export const criticalErrorsSummary: QueryDef = {
  id: "errors.summary",
  module: "critical-errors",
  title: { en: "Summary by tier", es: "Resumen por tier" },
  description: { en: "Total errors and criticals (24h) by tier", es: "Total de errores y críticos (24h) agregados por tier" },
  window: rangeWindow(24,
    { en: "Logs at ERROR level or above over the last 24 hours.", es: "Logs con nivel ERROR o superior de las últimas 24 horas." },
  ),
  build: (params?: QueryParams) =>
    `${criticalErrors.build(params)}\n| summarize contenedores = count(), errores_total = sum(errores), criticos_total = sum(criticos), by:{tier}\n| sort criticos_total desc`,
};
