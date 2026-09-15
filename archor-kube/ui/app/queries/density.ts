import type { QueryDef, QueryParams } from "./types";
import { USD_GB_MONTH, USD_VCPU_MONTH } from "./costModel";
import { rangeWindow } from "./analysisWindow";

/**
 * M4 — Densidad / Rightsizing de nodos (SPEC §4).
 * Query aportada por el usuario (2026-07-12) con 3 correcciones validadas
 * contra el environment:
 *  1. pods_running y requests usan sum() (avg() por nodo devolvía ~1 pod/nodo
 *     porque la métrica es un gauge por pod/contenedor).
 *  2. El subquery de totales del clúster agrupa por nodo antes de sumarizar
 *     (antes cluster_nodos siempre era 1 y nunca había CANDIDATO_ELIMINAR).
 *  3. CPU convertida de millicores a cores para etiquetas legibles.
 *
 * v2 (molde M3, 2026-07-14): valoriza la capacidad ociosa del nodo en USD/mes
 * (`ahorro_mes_usd`) y agrega `prioridad`. Módulo a nivel nodo: no tiene
 * tier/squad/tribu (los nodos no tienen dueño en el catálogo), así que no lleva
 * filtros transversales ni deep link a workload.
 */
export const nodeRightsizing: QueryDef = {
  id: "density.node-rightsizing",
  module: "density",
  title: "Rightsizing de nodos — consolidación por clúster",
  description:
    "Nodos subutilizados con acción sugerida: eliminar, consolidar o monitorear",
  window: rangeWindow(2,
    "Uso y capacidad de los nodos promediados sobre las últimas 2 horas (timeframe por defecto de Grail para `timeseries`).",
  ),
  build: () => `timeseries {
  node_cpu_alloc = avg(dt.kubernetes.node.cpu_allocatable),
  node_mem_alloc = avg(dt.kubernetes.node.memory_allocatable),
  pods_running   = sum(dt.kubernetes.pods),
  pods_max       = avg(dt.kubernetes.node.pods_allocatable)
}, by: {k8s.node.name, k8s.cluster.name}
| fieldsAdd
    pods_running_avg = round(arrayAvg(pods_running), decimals:1),
    pods_max_avg     = arrayAvg(pods_max),
    cpu_alloc_cores  = round(arrayAvg(node_cpu_alloc) / 1000, decimals:1),
    mem_alloc_gb     = round(arrayAvg(node_mem_alloc) / 1073741824, decimals:2)
| fieldsAdd
    pod_density_pct = if(pods_max_avg > 0,
                         round(pods_running_avg / pods_max_avg * 100, decimals:1),
                         else: 0.0)
| filter pod_density_pct < 30

// ── Paso 2: requests de pods en el nodo ─────────────────────
| join
  [
    timeseries {
      cpu_req = sum(dt.kubernetes.container.requests_cpu),
      mem_req = sum(dt.kubernetes.container.requests_memory)
    }, by: {k8s.node.name, k8s.cluster.name}
    | fieldsAdd
        cpu_requested_cores = round(arrayAvg(cpu_req) / 1000, decimals:1),
        mem_requested_gb    = round(arrayAvg(mem_req) / 1073741824, decimals:2)
  ],
  on: {k8s.node.name, k8s.cluster.name},
  kind: leftOuter
| fieldsAdd
    cpu_requested_cores = \`right.cpu_requested_cores\`,
    mem_requested_gb    = \`right.mem_requested_gb\`

// ── Paso 3: capacidad ociosa del nodo ────────────────────────
| fieldsAdd
    cpu_idle_cores = round(cpu_alloc_cores - cpu_requested_cores, decimals:1),
    mem_idle_gb    = round(mem_alloc_gb - mem_requested_gb, decimals:2)
| fieldsAdd
    cpu_idle_pct = if(cpu_alloc_cores > 0,
                      round(cpu_idle_cores / cpu_alloc_cores * 100, decimals:1),
                      else: 0.0),
    mem_idle_pct = if(mem_alloc_gb > 0,
                      round(mem_idle_gb / mem_alloc_gb * 100, decimals:1),
                      else: 0.0)

// ── Paso 4: totales del clúster (agrupando por nodo primero) ──
| join
  [
    timeseries {
      pods_running_c = sum(dt.kubernetes.pods),
      pods_max_c     = avg(dt.kubernetes.node.pods_allocatable)
    }, by: {k8s.node.name, k8s.cluster.name}
    | fieldsAdd
        node_pods     = arrayAvg(pods_running_c),
        node_pods_max = arrayAvg(pods_max_c)
    | summarize
        cluster_pods_total = round(sum(node_pods), decimals:0),
        cluster_pods_max   = round(sum(node_pods_max), decimals:0),
        cluster_nodos      = count(),
        by: {k8s.cluster.name}
  ],
  on: {k8s.cluster.name},
  kind: leftOuter
| fieldsAdd
    cluster_pods_total = \`right.cluster_pods_total\`,
    cluster_pods_max   = \`right.cluster_pods_max\`,
    cluster_nodos      = \`right.cluster_nodos\`

// ── Paso 5: nodos mínimos necesarios para correr todos los pods
| fieldsAdd
    nodos_minimos_cluster = if(pods_max_avg > 0,
                               round(cluster_pods_total / pods_max_avg + 1, decimals:0),
                               else: cluster_nodos)

// ── Paso 6: clasificación con contexto real ──────────────────
| fieldsAdd
    accion = if(cluster_nodos > nodos_minimos_cluster and pod_density_pct < 5,
                "CANDIDATO_ELIMINAR",
             else: if(pod_density_pct < 15,
                "CONSOLIDAR_SI_ES_POSIBLE",
             else: "MONITOREAR"))
| fieldsAdd prioridad = if(accion == "CANDIDATO_ELIMINAR", 1,
                        else: if(accion == "CONSOLIDAR_SI_ES_POSIBLE", 2, else: 3))

// ── Paso 7: capacidad ociosa valorizada (ahorro potencial) ───
| fieldsAdd ahorro_mes_usd = round(
    (if(cpu_idle_cores > 0, cpu_idle_cores, else: 0.0)) * ${USD_VCPU_MONTH}
  + (if(mem_idle_gb > 0, mem_idle_gb, else: 0.0)) * ${USD_GB_MONTH}, decimals:2)

| sort prioridad asc, pod_density_pct asc
| fields
    k8s.cluster.name,
    k8s.node.name,
    accion,
    prioridad,
    ahorro_mes_usd,
    cpu_alloc_cores,
    mem_alloc_gb,
    cpu_requested_cores,
    mem_requested_gb,
    cpu_idle_cores,
    cpu_idle_pct,
    mem_idle_gb,
    mem_idle_pct,
    pods_running_avg,
    pods_max_avg,
    pod_density_pct,
    cluster_nodos,
    cluster_pods_total,
    nodos_minimos_cluster`,
};

/**
 * Conteo de nodos por acción agrupado por clúster (los nodos no tienen
 * tier/squad/tribu, así que la única dimensión con sentido es el clúster).
 * Alimenta el CategoricalBarChart apilado del resumen.
 */
export const nodeActionBreakdown = (params?: QueryParams): string =>
  `${nodeRightsizing.build(params)}
| summarize nodos = count(), by:{ category = \`k8s.cluster.name\`, accion }
| sort category asc`;

/** Resumen ejecutivo: nodos por clúster y acción sugerida. */
export const nodeRightsizingSummary: QueryDef = {
  id: "density.summary",
  module: "density",
  title: "Resumen por clúster y acción",
  description: "Cantidad de nodos subutilizados por clúster y acción sugerida",
  window: rangeWindow(2,
    "Uso y capacidad de los nodos promediados sobre las últimas 2 horas (timeframe por defecto de Grail para `timeseries`).",
  ),
  build: (params?: QueryParams) =>
    `${nodeRightsizing.build(params)}\n| summarize nodos = count(), ahorro_mes_usd = round(sum(ahorro_mes_usd), decimals:0), cpu_idle_total = round(sum(cpu_idle_cores), decimals:1), mem_idle_total_gb = round(sum(mem_idle_gb), decimals:1), by:{prioridad, \`k8s.cluster.name\`, accion}\n| sort prioridad asc, nodos desc\n| fields \`k8s.cluster.name\`, accion, nodos, ahorro_mes_usd, cpu_idle_total, mem_idle_total_gb`,
};
