import type { QueryDef, QueryParams } from "./types";
import { deploymentIdJoin } from "./links";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { rangeWindow } from "./analysisWindow";

/**
 * M11 — Cuellos de botella (SPEC §4).
 * Dos ángulos de saturación:
 *  - Workloads: picos de CPU throttling (no promedio — el pico delata el cuello
 *    de botella intermitente que el avg esconde). Tiene tier → es el ángulo
 *    accionable que lleva el molde (filtros, Assist, deep link).
 *  - Nodos: dt.host.cpu.usage / dt.host.memory.usage (%) — las métricas
 *    dt.kubernetes.node.* de uso no existen en este environment (validado).
 *    Se muestra como gráfica complementaria al costado del resumen.
 *
 * v2 (molde M3, 2026-07-14): `severidad` del throttling (SEVERO/ALTO/MODERADO)
 * + join tier/squad/tribu + filtros transversales + deep link al workload.
 */
export const throttlingPeaks: QueryDef = {
  id: "bottlenecks.throttling",
  module: "bottlenecks",
  title: { en: "CPU throttling peaks by workload (24h)", es: "Picos de CPU throttling por workload (24h)" },
  description:
    { en: "Workloads whose peak throttling exceeds 25% of their CPU limit", es: "Workloads cuyo throttling pico supera el 25% de su límite de CPU" },
  window: rangeWindow(24,
    { en: "CPU throttling peaks over the last 24 hours. Note: the node saturation chart beside it only looks at the last 2 hours, so the two views don't cover the same period.", es: "Picos de CPU throttling de las últimas 24 horas. Ojo: la gráfica de saturación de nodos al costado mira solo las últimas 2 horas, así que las dos vistas no cubren el mismo periodo." },
  ),
  build: (params?: QueryParams) => `timeseries {
  throttled = avg(dt.kubernetes.container.cpu_throttled),
  cpu_limit = avg(dt.kubernetes.container.limits_cpu)
}, by: {k8s.workload.name, k8s.namespace.name, k8s.cluster.name}, from: now()-24h
| fieldsAdd
    throttle_peak = round(arrayMax(throttled), decimals:1),
    limit_avg     = round(arrayAvg(cpu_limit), decimals:1)
| filter limit_avg > 0
| fieldsAdd throttle_peak_pct = round(throttle_peak / limit_avg * 100, decimals:1)
| filter throttle_peak_pct > 25
| fieldsAdd severidad = if(throttle_peak_pct >= 100, "SEVERO",
                        else: if(throttle_peak_pct >= 50, "ALTO",
                        else: "MODERADO"))
| fieldsAdd prioridad = if(severidad == "SEVERO", 1,
                        else: if(severidad == "ALTO", 2, else: 3))
${deploymentIdJoin("`k8s.workload.name`")}
${tierLookupJoin("k8s.workload.name")}${tierFilterClause(params)}
| sort prioridad asc, throttle_peak_pct desc
| fields k8s.cluster.name, k8s.namespace.name, k8s.workload.name,
    tier, squad, tribu, appCode, severidad, prioridad,
    limit_avg, throttle_peak, throttle_peak_pct, deployment_id`,
};

/** Dimensión del eje de la gráfica categórica de severidad. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de workloads por severidad de throttling agrupado por una dimensión.
 * (Disponible por consistencia con el molde; la gráfica lateral de M11 usa la
 * saturación de nodos, ver `nodeSaturation`.)
 */
export const throttlingBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${throttlingPeaks.build(params)}
| summarize workloads = count(), by:{ category = coalesce(${dimension}, "(sin ${dimension})"), severidad }
| sort category asc`;

/** Resumen ejecutivo: workloads con throttling por severidad y tier. */
export const throttlingSummary: QueryDef = {
  id: "bottlenecks.throttling-summary",
  module: "bottlenecks",
  title: { en: "Summary by throttling severity and tier", es: "Resumen por severidad de throttling y tier" },
  description: { en: "Workloads with throttling peaks by severity and tier", es: "Workloads con picos de throttling por severidad y tier" },
  window: rangeWindow(24,
    { en: "CPU throttling peaks over the last 24 hours.", es: "Picos de CPU throttling de las últimas 24 horas." },
  ),
  build: (params?: QueryParams) =>
    `${throttlingPeaks.build(params)}\n| summarize workloads = count(), peak_max_pct = round(max(throttle_peak_pct), decimals:0), by:{prioridad, severidad, tier}\n| sort prioridad asc, tier asc\n| fields severidad, tier, workloads, peak_max_pct`,
};

export const nodeSaturation: QueryDef = {
  id: "bottlenecks.nodes",
  module: "bottlenecks",
  title: { en: "Node saturation (CPU/MEM %)", es: "Saturación de nodos (CPU/MEM %)" },
  description: { en: "Nodes with host CPU or memory usage above 80%", es: "Nodos con uso de CPU o memoria del host sobre el 80%" },
  window: rangeWindow(2,
    { en: "Node CPU and memory usage over the last 2 hours (Grail's default timeframe).", es: "Uso de CPU y memoria de los nodos en las últimas 2 horas (timeframe por defecto de Grail)." },
  ),
  build: () => `timeseries {
  cpu = avg(dt.host.cpu.usage),
  mem = avg(dt.host.memory.usage)
}, by: {k8s.node.name, k8s.cluster.name}
| fieldsAdd
    cpu_avg = round(arrayAvg(cpu), decimals:1),
    cpu_max = round(arrayMax(cpu), decimals:1),
    mem_avg = round(arrayAvg(mem), decimals:1),
    mem_max = round(arrayMax(mem), decimals:1)
| filter cpu_max > 80 or mem_max > 80
| sort cpu_max desc, mem_max desc
| fields k8s.cluster.name, k8s.node.name, cpu_avg, cpu_max, mem_avg, mem_max`,
};
