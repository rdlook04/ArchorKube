import type { QueryDef, QueryParams } from "./types";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { snapshotWindow } from "./analysisWindow";
import { excludedNamespacesClause } from "./namespaces";

/**
 * M6 — Huérfanos (SPEC §4).
 * Dos tipos de orfandad detectados sobre smartscape (validado: 92 con 0 réplicas):
 *  - REPLICAS_0: deployments/statefulsets escalados a cero que siguen definidos.
 *  - SIN_DUENO: workloads corriendo cuyo nombre no existe en el catálogo
 *    el catálogo de propiedad (sin dueño organizacional identificable).
 *
 * v2 (molde M3, 2026-07-14): filtros transversales + deep link al workload
 * (el `id` del nodo smartscape ya es el deployment_id, sin join extra) + tribu.
 */
export const orphanWorkloads: QueryDef = {
  id: "orphans.workloads",
  module: "orphans",
  title: { en: "Orphan workloads — no replicas or no owner", es: "Workloads huérfanos — sin réplicas o sin dueño" },
  description:
    { en: "Deployments/StatefulSets with 0 replicas or no owner in the ownership catalog", es: "Deployments/StatefulSets con 0 réplicas o sin dueño en el catálogo de propiedad" },
  window: snapshotWindow(
    { en: "Snapshot of the current topology (smartscape): workloads as they are defined right now, no history.", es: "Foto del estado actual de la topología (smartscape): los workloads tal como están definidos ahora mismo, sin histórico." },
  ),
  build: (params?: QueryParams) => `smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET
| parse k8s.object, "JSON:config"
| fieldsAdd replicas = config[\`spec\`][\`replicas\`]
| fieldsAdd deployment_id = id
${excludedNamespacesClause()}
${tierLookupJoin("k8s.workload.name")}
| fieldsAdd motivo = if(replicas == 0, "REPLICAS_0",
                     else: if(isNull(appCode) and isNull(squad), "SIN_DUENO",
                     else: "OK"))
| filter motivo != "OK"${tierFilterClause(params)}
| fieldsAdd prioridad = if(motivo == "REPLICAS_0", 1, else: 2)
| sort prioridad asc, k8s.namespace.name asc
| fields k8s.cluster.name, k8s.namespace.name, k8s.workload.name, k8s.workload.kind,
    tier, squad, tribu, appCode, replicas, motivo, prioridad, deployment_id`,
};

/** Dimensión del eje de la gráfica categórica de motivos. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de workloads por motivo agrupado por una dimensión (tier/squad/tribu).
 * Alimenta el CategoricalBarChart apilado del resumen. Nota: los SIN_DUENO
 * no tienen dueño, así que caen en la categoría "(sin …)".
 */
export const orphanBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${orphanWorkloads.build(params)}
| summarize workloads = count(), by:{ category = coalesce(${dimension}, "(sin ${dimension})"), motivo }
| sort category asc`;

/** Resumen ejecutivo: huérfanos por motivo. */
export const orphanSummary: QueryDef = {
  id: "orphans.summary",
  module: "orphans",
  title: { en: "Summary by reason", es: "Resumen por motivo" },
  description: { en: "Orphan workloads by reason and cluster", es: "Cantidad de workloads huérfanos por motivo y clúster" },
  window: snapshotWindow(
    { en: "Snapshot of the current topology (smartscape), no history.", es: "Foto del estado actual de la topología (smartscape), sin histórico." },
  ),
  build: (params?: QueryParams) =>
    `${orphanWorkloads.build(params)}\n| summarize workloads = count(), by:{prioridad, motivo, tier}\n| sort prioridad asc, tier asc\n| fields motivo, tier, workloads`,
};
