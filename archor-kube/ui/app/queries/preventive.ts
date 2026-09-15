import type { QueryDef, QueryParams } from "./types";
import { deploymentIdJoin } from "./links";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { rangeWindow } from "./analysisWindow";
import { excludedNamespacesClause } from "./namespaces";

/**
 * M8 — Detección preventiva (SPEC §4).
 * Señales tempranas de degradación en 24h: restart loops y OOM kills, con el
 * contexto de memoria (uso vs límite) que suele explicar el OOM.
 *
 * v2 (molde M3, 2026-07-14):
 *   - `union:true`: sin él, el join interno de timeseries dejaba SOLO los
 *     workloads que reportan oom_kills (por eso antes "todos salían OOM_KILL");
 *     con union aparecen también los restart loops sin OOM.
 *   - restarts como delta del contador (last−first), no `arraySum` (que suma
 *     todas las muestras de un contador acumulado e infla el valor).
 *   - join tier/squad/tribu compartido + filtros transversales + deep link.
 * (Eventos K8s nativos no están ingestados en este environment; Davis events
 * quedan como mejora futura.)
 */
export const preventiveSignals: QueryDef = {
  id: "preventive.signals",
  module: "preventive",
  title: "Señales preventivas — restarts y OOM kills (24h)",
  description:
    "Workloads con restart loops u OOM kills: degradación antes del incidente",
  window: rangeWindow(24,
    "OOM kills y reinicios contados sobre las últimas 24 horas.",
  ),
  build: (params?: QueryParams) => `timeseries {
  restarts  = sum(dt.kubernetes.container.restarts),
  ooms      = sum(dt.kubernetes.container.oom_kills),
  mem       = avg(dt.kubernetes.container.memory_working_set),
  mem_limit = avg(dt.kubernetes.container.limits_memory)
}, by: {k8s.workload.name, k8s.namespace.name, k8s.cluster.name}, from: now()-24h, union:true
| fieldsAdd
    ooms_24h       = round(coalesce(arraySum(ooms), 0)),
    restarts_delta = arrayLast(restarts) - arrayFirst(restarts),
    mem_avg_mb     = round(arrayAvg(mem) / 1048576, decimals:1),
    mem_limit_mb   = round(arrayAvg(mem_limit) / 1048576, decimals:1)
| fieldsAdd restarts_24h = if(isNull(restarts_delta) or restarts_delta < 0, 0, else: round(restarts_delta))
${excludedNamespacesClause()}
| filter restarts_24h > 3 or ooms_24h > 0
| fieldsAdd mem_uso_pct = if(mem_limit_mb > 0, round(mem_avg_mb / mem_limit_mb * 100, decimals:1), else: 0.0)
| fieldsAdd
    senal = if(ooms_24h > 0, "OOM_KILL",
            else: if(restarts_24h > 10, "RESTART_LOOP",
            else: "RESTARTS_ELEVADOS"))
| fieldsAdd prioridad = if(senal == "OOM_KILL", 1, else: if(senal == "RESTART_LOOP", 2, else: 3))
${deploymentIdJoin("`k8s.workload.name`")}
${tierLookupJoin("k8s.workload.name")}${tierFilterClause(params)}
| sort prioridad asc, ooms_24h desc, restarts_24h desc
| fields k8s.cluster.name, k8s.namespace.name, k8s.workload.name,
    tier, squad, tribu, appCode, senal, prioridad,
    restarts_24h, ooms_24h, mem_avg_mb, mem_limit_mb, mem_uso_pct, deployment_id`,
};

/** Dimensión del eje de la gráfica categórica de señales. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de workloads por señal agrupado por una dimensión (tier/squad/tribu).
 * Alimenta el CategoricalBarChart apilado del resumen.
 */
export const preventiveBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${preventiveSignals.build(params)}
| summarize workloads = count(), by:{ category = coalesce(${dimension}, "(sin ${dimension})"), senal }
| sort category asc`;

/** Resumen ejecutivo: señales por tipo y tier. */
export const preventiveSummary: QueryDef = {
  id: "preventive.summary",
  module: "preventive",
  title: "Resumen por señal y tier",
  description: "Cantidad de workloads con señales preventivas por tier",
  window: rangeWindow(24,
    "OOM kills y reinicios contados sobre las últimas 24 horas.",
  ),
  build: (params?: QueryParams) =>
    `${preventiveSignals.build(params)}\n| summarize workloads = count(), by:{prioridad, senal, tier}\n| sort prioridad asc, tier asc\n| fields senal, tier, workloads`,
};
