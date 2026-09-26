import type { QueryDef } from "./types";
import { deploymentIdJoin } from "./links";
import { reservedResourcesJoin, USD_GB_MONTH, USD_VCPU_MONTH } from "./costModel";
import { serviceRequestsJoin } from "./serviceRequests";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { rangeWindow } from "./analysisWindow";
import { excludedNamespacesClause } from "./namespaces";

/**
 * Ancho de las bandas de memoria reservada: 0–200 MB, 201–400 MB, y así.
 *
 * Se bandea la reserva (`requests`) y no el uso, porque la reserva es lo que
 * se paga y lo que el scheduler bloquea en el nodo. El uso real entra después
 * como comparación contra esa banda (`mem_uso_pct` y `uso_vs_reserva`): así la
 * pregunta pasa de "cuánta memoria gasta" a "cuánta apartó y qué fracción de
 * eso realmente ocupa".
 */
export const MEM_BUCKET_MB = 200;

/** Etiqueta de la banda cuando el workload no declara requests de memoria. */
export const MEM_RANGE_UNKNOWN = "(sin memoria reservada)";

/**
 * M3 — Ociosos (SPEC §4), v2 con la "Regla de Oro del workload ocioso":
 * CPU baja no basta — un ocioso real debe cumplir tres condiciones a la vez:
 *   1. Cero tráfico comercial: ≤10 requests APM en 7 días.
 *   2. Cero inestabilidad: sin OOM kills ni restart loops (si se cae, está roto, no ocioso).
 *   3. CPU ≈ 0 sostenida 7 días (MUERTO: pico <1 mc; OCIOSO: avg <5 y pico <20).
 * Cada fila lleva `veredicto` y `motivo` con la evidencia (requests, CPU, OOM/restarts).
 * Validado 2026-07-13: de 823 candidatos por CPU, solo 6 OCIOSO_CONFIRMADO;
 * 647 descartados por tráfico (hasta 1.6M requests/7d), 81 inestables, 89 sin dato APM.
 * union:true es necesario: sin él, timeseries hace join interno y solo quedan
 * los workloads que reportan oom_kills.
 */
export const idleWorkloads: QueryDef = {
  id: "idle.workloads",
  module: "idle",
  title: { en: "Low-CPU candidates with a traffic and stability verdict (7 days)", es: "Candidatos por CPU baja con veredicto de tráfico y estabilidad (7 días)" },
  description:
    { en: "Golden rule: truly idle = no requests + no crashes + CPU ≈ 0 over 7 days", es: "Regla de Oro: ocioso real = sin requests + sin caídas + CPU ≈ 0 en 7 días" },
  window: rangeWindow(168,
    { en: "Activity over the last 7 days. The window is long on purpose: a workload only counts as idle if it had no traffic or usage for the whole week.", es: "Actividad de los últimos 7 días. La ventana es larga a propósito: un workload solo cuenta como ocioso si no tuvo tráfico ni consumo en toda la semana." },
  ),
  build: (params) => `timeseries {
  cpu = avg(dt.kubernetes.container.cpu_usage),
  mem = avg(dt.kubernetes.container.memory_working_set),
  restarts = sum(dt.kubernetes.container.restarts),
  ooms = sum(dt.kubernetes.container.oom_kills)
}, by: {k8s.workload.name, k8s.namespace.name, k8s.cluster.name}, from: now()-7d, union:true
| fieldsAdd
    cpu_avg = round(arrayAvg(cpu), decimals:2),
    cpu_max = round(arrayMax(cpu), decimals:2),
    mem_avg_mb = round(arrayAvg(mem) / 1048576, decimals:1),
    restarts_delta = arrayLast(restarts) - arrayFirst(restarts),
    ooms_7d = round(coalesce(arraySum(ooms), 0))
| fieldsAdd restarts_7d = if(isNull(restarts_delta) or restarts_delta < 0, 0, else:round(restarts_delta))
${excludedNamespacesClause()}
| fieldsAdd
    estado = if(cpu_max < 1, "MUERTO",
             else: if(cpu_avg < 5 and cpu_max < 20, "OCIOSO",
             else: "ACTIVO"))
| filter estado != "ACTIVO"
${serviceRequestsJoin("`k8s.workload.name`")}
${deploymentIdJoin("`k8s.workload.name`")}
| fieldsAdd
    veredicto = if(ooms_7d > 0 or restarts_7d > 3, "DESCARTADO_INESTABLE",
               else: if(isNotNull(req_total) and req_total > 10, "DESCARTADO_CON_TRAFICO",
               else: if(isNull(req_total), "OCIOSO_SIN_DATO_APM",
               else: "OCIOSO_CONFIRMADO")))
| fieldsAdd
    motivo = if(veredicto == "OCIOSO_CONFIRMADO",
                concat("Solo ", toString(round(coalesce(req_total, 0))), " requests en 7d, CPU max ", toString(cpu_max), " mc, sin OOM ni restarts: candidato real a escalar a cero"),
             else: if(veredicto == "DESCARTADO_CON_TRAFICO",
                concat("Atendió ", toString(round(req_total)), " requests en 7d con CPU baja: servicio eficiente, NO ocioso"),
             else: if(veredicto == "DESCARTADO_INESTABLE",
                concat("OOM kills=", toString(ooms_7d), ", restarts=", toString(restarts_7d), " en 7d: está roto, no ocioso"),
             else: concat("Sin servicio APM medible; evidencia solo de CPU (max ", toString(cpu_max), " mc en 7d), confianza media"))))
| fieldsAdd prioridad = if(veredicto == "OCIOSO_CONFIRMADO", 1,
             else: if(veredicto == "OCIOSO_SIN_DATO_APM", 2,
             else: if(veredicto == "DESCARTADO_INESTABLE", 3, else: 4)))
${reservedResourcesJoin("`k8s.workload.name`")}
| fieldsAdd perdida_mes_usd = if(startsWith(veredicto, "OCIOSO"),
    round((coalesce(req_cpu_mc, cpu_avg, 0) / 1000) * ${USD_VCPU_MONTH}
        + (coalesce(req_mem_mb, mem_avg_mb, 0) / 1024) * ${USD_GB_MONTH}, decimals:2),
    else: 0.0)
| fieldsAdd mem_bucket = if(isNull(req_mem_mb) or req_mem_mb <= 0, -1,
             else: toLong(ceil(req_mem_mb / ${MEM_BUCKET_MB})) - 1)
| fieldsAdd rango_mem = if(mem_bucket < 0, "${MEM_RANGE_UNKNOWN}",
             else: if(mem_bucket == 0, "0 - ${MEM_BUCKET_MB} MB",
             else: concat(toString(mem_bucket * ${MEM_BUCKET_MB} + 1), " - ", toString(mem_bucket * ${MEM_BUCKET_MB} + ${MEM_BUCKET_MB}), " MB")))
| fieldsAdd mem_uso_pct = if(mem_bucket < 0, null,
             else: toLong(round(coalesce(mem_avg_mb, 0) / req_mem_mb * 100)))
| fieldsAdd uso_vs_reserva = if(isNull(mem_uso_pct), "SIN_RESERVA",
             else: if(mem_uso_pct > 100, "POR_ENCIMA",
             else: if(mem_uso_pct >= 85, "AL_LIMITE",
             else: if(mem_uso_pct >= 50, "AJUSTADO", else: "HOLGADO"))))
${tierLookupJoin("k8s.workload.name")}${tierFilterClause(params)}
| sort prioridad asc, cpu_max asc
| fields k8s.cluster.name, k8s.namespace.name, k8s.workload.name,
    tier, squad, tribu, appCode, estado, veredicto, motivo,
    req_total, cpu_avg, cpu_max, mem_avg_mb, restarts_7d, ooms_7d,
    req_cpu_mc, req_mem_mb, perdida_mes_usd, prioridad, service_id, deployment_id,
    rango_mem, mem_bucket, mem_uso_pct, uso_vs_reserva`,
};

/** Dimensión del eje de la gráfica categórica de veredictos. */
export type BreakdownDimension = "tier" | "squad" | "tribu" | "rango_mem" | "uso_vs_reserva";

/** Etiqueta de la barra cuando la dimensión no tiene valor en esa fila. */
const BREAKDOWN_FALLBACK: Record<BreakdownDimension, string> = {
  tier: "(sin tier)",
  squad: "(sin squad)",
  tribu: "(sin tribu)",
  rango_mem: MEM_RANGE_UNKNOWN,
  uso_vs_reserva: "SIN_RESERVA",
};

/**
 * Clave de orden de las barras. Las dimensiones del catálogo se ordenan
 * alfabéticamente; las bandas de memoria, por su número de banda, porque
 * "1001 - 1200 MB" iría antes que "201 - 400 MB" si se ordenara como texto.
 * La banda sin dato se manda al final.
 */
const BREAKDOWN_ORDER: Record<BreakdownDimension, string> = {
  tier: "0",
  squad: "0",
  tribu: "0",
  rango_mem: "if(isNull(mem_bucket) or mem_bucket < 0, 999999, else: mem_bucket)",
  uso_vs_reserva: `if(uso_vs_reserva == "POR_ENCIMA", 0,
    else: if(uso_vs_reserva == "AL_LIMITE", 1,
    else: if(uso_vs_reserva == "AJUSTADO", 2,
    else: if(uso_vs_reserva == "HOLGADO", 3, else: 4))))`,
};

/**
 * Conteo de workloads por veredicto agrupado por una dimensión (tier/squad/
 * tribu, banda de memoria reservada o uso vs. reserva). Alimenta el
 * CategoricalBarChart apilado: cada barra = una categoría de la dimensión,
 * cada segmento = un veredicto de la Regla de Oro.
 */
export const idleBreakdown = (dimension: BreakdownDimension, params?: Parameters<typeof idleWorkloads.build>[0]): string =>
  `${idleWorkloads.build(params)}
| fieldsAdd category = coalesce(${dimension}, "${BREAKDOWN_FALLBACK[dimension]}"), orden = ${BREAKDOWN_ORDER[dimension]}
| summarize workloads = count(), by:{ category, orden, veredicto }
| sort orden asc, category asc`;

/** Resumen ejecutivo: candidatos por veredicto y tier. */
export const idleSummary: QueryDef = {
  id: "idle.summary",
  module: "idle",
  title: { en: "Summary by verdict and tier", es: "Resumen por veredicto y tier" },
  description: { en: "Workloads by golden-rule verdict and tier", es: "Cantidad de workloads por veredicto de la Regla de Oro y tier" },
  window: rangeWindow(168,
    { en: "Activity over the last 7 days.", es: "Actividad de los últimos 7 días." },
  ),
  build: (params) =>
    `${idleWorkloads.build(params)}\n| summarize workloads = count(), perdida_mes_usd = round(sum(perdida_mes_usd), decimals:0), by:{prioridad, veredicto, tier}\n| sort prioridad asc, tier asc\n| fields veredicto, tier, workloads, perdida_mes_usd`,
};
