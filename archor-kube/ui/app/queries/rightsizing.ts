import type { QueryDef, QueryParams } from "./types";
import { deploymentIdJoin } from "./links";
import { USD_GB_MONTH, USD_VCPU_MONTH } from "./costModel";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { rangeWindow } from "./analysisWindow";

/**
 * M1/M2 — Rightsizing CPU y Memoria (SPEC §4).
 * Query aportada por el usuario (2026-07-12): capacidad ociosa (slack) y
 * CPU throttling por pod, últimas 2 horas (timeframe por defecto de Grail).
 * Umbrales: entra a la lista con slack >40%, throttle >25% o slack negativo;
 * se etiqueta SOBREAPROVISIONADO con slack >70% (entre 40% y 70% queda REVISAR).
 *
 * v2 (molde M3, 2026-07-13): usa el join tier/squad/tribu compartido
 * (`tierLookupJoin`) con filtros transversales, valoriza el slack ocioso en
 * USD/mes (`perdida_mes_usd`) y agrega deep link al workload K8s.
 */
export const rightsizingReport: QueryDef = {
  id: "rightsizing.report",
  module: "rightsizing-cpu",
  title: "Rightsizing — capacidad ociosa y CPU throttling",
  description:
    "Pods con sobreaprovisionamiento, requests subdimensionados o throttling crítico",
  window: rangeWindow(2,
    "Promedios de CPU y memoria de las últimas 2 horas (timeframe por defecto de Grail para `timeseries`). Es una ventana corta: un pico o un valle puntual puede distorsionar la recomendación, así que conviene contrastarla antes de recortar requests.",
  ),
  build: (params?: QueryParams) => `timeseries {
  cpu_usage     = avg(dt.kubernetes.container.cpu_usage),
  cpu_request   = avg(dt.kubernetes.container.requests_cpu),
  cpu_limit     = avg(dt.kubernetes.container.limits_cpu),
  cpu_throttled = avg(dt.kubernetes.container.cpu_throttled),
  mem_usage     = avg(dt.kubernetes.container.memory_working_set),
  mem_request   = avg(dt.kubernetes.container.requests_memory),
  mem_limit     = avg(dt.kubernetes.container.limits_memory)
}, by: {k8s.pod.name, k8s.workload.name, k8s.namespace.name, k8s.cluster.name}

// ── Promedios escalares ──────────────────────────────────────
| fieldsAdd
    cpu_usage_avg    = arrayAvg(cpu_usage),
    cpu_request_avg  = arrayAvg(cpu_request),
    cpu_limit_avg    = arrayAvg(cpu_limit),
    cpu_throttle_avg = arrayAvg(cpu_throttled),
    mem_usage_avg    = arrayAvg(mem_usage),
    mem_request_avg  = arrayAvg(mem_request),
    mem_limit_avg    = arrayAvg(mem_limit)

// ── KPIs de eficiencia ───────────────────────────────────────
| fieldsAdd
    cpu_slack_pct    = if(cpu_request_avg > 0,
                          round((cpu_request_avg - cpu_usage_avg) / cpu_request_avg * 100, decimals:1),
                          else: 0.0),
    mem_slack_pct    = if(mem_request_avg > 0,
                          round((mem_request_avg - mem_usage_avg) / mem_request_avg * 100, decimals:1),
                          else: 0.0),
    cpu_throttle_pct = if(cpu_limit_avg > 0,
                          round(cpu_throttle_avg / cpu_limit_avg * 100, decimals:1),
                          else: 0.0),
    cpu_slack_mcores = round(cpu_request_avg - cpu_usage_avg, decimals:1),
    mem_slack_mb     = round((mem_request_avg - mem_usage_avg) / 1048576, decimals:1)

// ── Filtro de calidad: requests definidos ────────────────────
| filter cpu_request_avg > 0 and mem_request_avg > 0

// ── Clasificación del problema ───────────────────────────────
| fieldsAdd
    problema = if(cpu_throttle_pct > 25,                              "THROTTLING_CRITICO",
               else: if(cpu_slack_pct < 0 or mem_slack_pct < 0,      "REQUEST_SUBDIMENSIONADO",
               else: if(cpu_slack_pct > 70 and mem_slack_pct > 70,   "SOBREAPROVISIONADO_CPU_MEM",
               else: if(cpu_slack_pct > 70,                           "SOBREAPROVISIONADO_CPU",
               else: if(mem_slack_pct > 70,                           "SOBREAPROVISIONADO_MEM",
               else: "REVISAR")))))
| fieldsAdd prioridad = if(problema == "THROTTLING_CRITICO", 1,
               else: if(problema == "REQUEST_SUBDIMENSIONADO", 2,
               else: if(problema == "SOBREAPROVISIONADO_CPU_MEM", 3,
               else: if(problema == "SOBREAPROVISIONADO_CPU", 4,
               else: if(problema == "SOBREAPROVISIONADO_MEM", 5, else: 6)))))

// ── Umbral: solo pods con algún problema relevante ───────────
| filter cpu_slack_pct > 40 or mem_slack_pct > 40 or cpu_throttle_pct > 25
       or cpu_slack_pct < 0 or mem_slack_pct < 0

// ── Slack valorizado: dinero ocioso reservado y no usado ─────
| fieldsAdd perdida_mes_usd = round(
    (if(cpu_slack_mcores > 0, cpu_slack_mcores, else: 0.0) / 1000) * ${USD_VCPU_MONTH}
  + (if(mem_slack_mb > 0, mem_slack_mb, else: 0.0) / 1024) * ${USD_GB_MONTH}, decimals:2)

// ── Deep link al workload K8s (Smartscape) ───────────────────
${deploymentIdJoin("`k8s.workload.name`")}

// ── Enriquecimiento tier/squad/tribu (M7, catálogo de propiedad) ─────
${tierLookupJoin("k8s.workload.name")}${tierFilterClause(params)}

// ── Ordenar: throttling/subdimensionado primero, luego mayor desperdicio ──
| sort prioridad asc, perdida_mes_usd desc, cpu_throttle_pct desc

// ── Proyección final ─────────────────────────────────────────
| fields
    k8s.cluster.name,
    k8s.namespace.name,
    k8s.workload.name,
    k8s.pod.name,
    tier,
    squad,
    tribu,
    problema,
    prioridad,
    cpu_usage_avg,
    cpu_request_avg,
    cpu_slack_mcores,
    cpu_slack_pct,
    cpu_throttle_pct,
    mem_usage_avg,
    mem_request_avg,
    mem_slack_mb,
    mem_slack_pct,
    perdida_mes_usd,
    deployment_id`,
};

/** Dimensión del eje de la gráfica categórica de problemas. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de pods por problema agrupado por una dimensión (tier/squad/tribu).
 * Alimenta el CategoricalBarChart apilado del resumen.
 */
export const rightsizingBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${rightsizingReport.build(params)}
| summarize pods = count(), by:{ category = coalesce(${dimension}, "(sin ${dimension})"), problema }
| sort category asc`;

/** Resumen ejecutivo: pods con hallazgo por problema y tier, con slack valorizado. */
export const rightsizingSummary: QueryDef = {
  id: "rightsizing.summary",
  module: "rightsizing-cpu",
  title: "Resumen por problema y tier",
  description: "Cantidad de pods con hallazgo y slack valorizado, por problema y tier",
  window: rangeWindow(2,
    "Promedios de CPU y memoria de las últimas 2 horas (timeframe por defecto de Grail para `timeseries`).",
  ),
  build: (params?: QueryParams) =>
    `${rightsizingReport.build(params)}\n| summarize pods = count(), slack_mes_usd = round(sum(perdida_mes_usd), decimals:0), by:{prioridad, problema, tier}\n| sort prioridad asc, tier asc\n| fields problema, tier, pods, slack_mes_usd`,
};
