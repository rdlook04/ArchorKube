import type { QueryDef, QueryParams } from "./types";
import { deploymentIdJoin } from "./links";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { snapshotWindow } from "./analysisWindow";
import { excludedNamespacesClause } from "./namespaces";
import { noneLabel } from "./lang";

/**
 * M5 — Riesgo de caída por workload (SPEC §4).
 * Query aportada por el usuario (2026-07-12): deployments/statefulsets con
 * réplica única y/o contenedores sin liveness/readiness probe.
 * risk_score = single_replica + liveness_gap + readiness_gap (0-3).
 *
 * v2 (molde M3, 2026-07-14): filtra a risk_score >= 1 (los de score 0 no tienen
 * riesgo, eran ~83% de ruido); `nivel` (CRITICO/ALTO/MEDIO) para color y gráfica;
 * join tier/squad/tribu compartido + filtros transversales + deep link.
 */
export const workloadRisk: QueryDef = {
  id: "risk.workloads",
  module: "availability-risk",
  title: { en: "Outage risk — single replicas and missing probes", es: "Riesgo de caída — réplicas únicas y probes faltantes" },
  description:
    { en: "Workloads with a single replica or no liveness/readiness, with a 1-3 score and tier/squad", es: "Workloads con réplica única o sin liveness/readiness, con score 1-3 y tier/squad" },
  window: snapshotWindow(
    { en: "Snapshot of the current topology (smartscape): replicas and probes as they are defined right now, no history.", es: "Foto del estado actual de la topología (smartscape): réplicas y probes tal como están definidos ahora mismo, sin histórico." },
  ),
  build: (params?: QueryParams) => `smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET
| parse k8s.object, "JSON:config"
| fieldsAdd
    desired_replicas = config[\`spec\`][\`replicas\`]
| expand container = config[\`spec\`][\`template\`][\`spec\`][\`containers\`]
| fieldsAdd
    container_name  = container[\`name\`],
    has_liveness    = isNotNull(container[\`livenessProbe\`]),
    has_readiness   = isNotNull(container[\`readinessProbe\`])
${excludedNamespacesClause()}
| summarize
    replicas        = max(desired_replicas),
    containers      = count(),
    with_liveness   = countIf(has_liveness),
    with_readiness  = countIf(has_readiness),
    by: {k8s.cluster.name, k8s.namespace.name, k8s.workload.name, k8s.workload.kind}
| fieldsAdd
    single_replica    = if(replicas == 1 or isNull(replicas), "SI", else: "OK"),
    liveness_gap      = if(with_liveness < containers, "FALTA", else: "OK"),
    readiness_gap     = if(with_readiness < containers, "FALTA", else: "OK"),
    risk_score        = (if(replicas == 1 or isNull(replicas), 1, else: 0))
                      + (if(with_liveness < containers, 1, else: 0))
                      + (if(with_readiness < containers, 1, else: 0))
| filter risk_score >= 1
| fieldsAdd nivel = if(risk_score >= 3, "CRITICO",
                    else: if(risk_score == 2, "ALTO",
                    else: "MEDIO"))
${deploymentIdJoin("`k8s.workload.name`")}
${tierLookupJoin("k8s.workload.name")}${tierFilterClause(params)}
| sort risk_score desc, tier asc
| fields k8s.cluster.name, k8s.namespace.name, k8s.workload.name, k8s.workload.kind,
    tier, squad, tribu, appCode,
    replicas, single_replica, liveness_gap, readiness_gap, risk_score, nivel, deployment_id`,
};

/** Dimensión del eje de la gráfica categórica de niveles de riesgo. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de workloads por nivel de riesgo agrupado por una dimensión.
 * Alimenta el CategoricalBarChart apilado del resumen.
 */
export const riskBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${workloadRisk.build(params)}
| summarize workloads = count(), by:{ category = coalesce(${dimension}, "${noneLabel(dimension, params)}"), nivel }
| sort category asc`;

/** Resumen ejecutivo: workloads por score de riesgo y tier. */
export const workloadRiskSummary: QueryDef = {
  id: "risk.summary",
  module: "availability-risk",
  title: { en: "Summary by risk level and tier", es: "Resumen por nivel de riesgo y tier" },
  description: { en: "Workloads by risk level/score and tier", es: "Cantidad de workloads por nivel/score de riesgo y tier" },
  window: snapshotWindow(
    { en: "Snapshot of the current topology (smartscape), no history.", es: "Foto del estado actual de la topología (smartscape), sin histórico." },
  ),
  build: (params?: QueryParams) =>
    `${workloadRisk.build(params)}\n| summarize workloads = count(), by:{risk_score, nivel, tier}\n| sort risk_score desc, tier asc\n| fields nivel, risk_score, tier, workloads`,
};
