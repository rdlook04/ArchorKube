import type { QueryDef, QueryParams } from "./types";
import { deploymentIdJoin } from "./links";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { snapshotWindow } from "./analysisWindow";

/**
 * M5 (parcial) — Elasticidad HPA (SPEC §4, riesgo de caída).
 * Query aportada por el usuario (2026-07-12) sobre smartscapeNodes
 * (scope storage:smartscape:read). Ajustes acordados:
 *  - Sin filtro fijo de clúster: cubre todos y expone la columna cluster.
 *  - Etiquetas de elasticidad sin emoji para agrupar/ordenar estable.
 * Nota: config[status][conditions][2] asume que ScalingLimited es la 3ª
 * condición del HPA; si algún clúster reporta otro orden, revisar.
 *
 * v2 (molde M3, 2026-07-14): join tier/squad/tribu compartido + filtros
 * transversales + deep link al workload (el HPA suele llamarse igual que su
 * deployment). Sin USD (es disponibilidad, no consumo).
 */
export const hpaElasticity: QueryDef = {
  id: "elasticity.hpa",
  module: "availability-risk",
  title: "Elasticidad HPA — réplicas y bloqueos",
  description:
    "HPAs bloqueados (TooManyReplicas), sin margen (min=max) u OK, con tier y squad",
  window: snapshotWindow(
    "Foto del estado actual de los HorizontalPodAutoscalers (smartscape): min/max de réplicas y condiciones tal como están ahora, sin histórico.",
  ),
  build: (params?: QueryParams) => `smartscapeNodes K8S_HORIZONTALPODAUTOSCALER
| parse k8s.object, "JSON:config"
| fieldsAdd
    hpa_name    = config[metadata][name],
    hpa_min     = config[spec][minReplicas],
    hpa_max     = config[spec][maxReplicas],
    hpa_current = config[status][currentReplicas],
    hpa_desired = config[status][desiredReplicas],
    hpa_status  = config[status][conditions][2][reason]
| fieldsAdd elasticidad =
    if(hpa_status == "TooManyReplicas", "BLOQUEADO_NECESITA_MAX",
    else: if(hpa_max == hpa_min, "SIN_MARGEN_MIN_ES_MAX",
    else: "OK"))
| fieldsAdd prioridad = if(elasticidad == "BLOQUEADO_NECESITA_MAX", 1,
                        else: if(elasticidad == "SIN_MARGEN_MIN_ES_MAX", 2, else: 3))
${deploymentIdJoin("hpa_name")}
${tierLookupJoin("hpa_name")}${tierFilterClause(params, "hpa_name")}
| sort prioridad asc, tier asc
| fields
    k8s.cluster.name,
    k8s.namespace.name,
    hpa_name,
    tier,
    squad,
    tribu,
    appCode,
    hpa_min,
    hpa_max,
    hpa_current,
    hpa_desired,
    elasticidad,
    prioridad,
    deployment_id`,
};

/** Dimensión del eje de la gráfica categórica de elasticidad. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de HPAs por estado de elasticidad agrupado por una dimensión.
 * Alimenta el CategoricalBarChart apilado del resumen.
 */
export const elasticityBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${hpaElasticity.build(params)}
| summarize hpas = count(), by:{ category = coalesce(${dimension}, "(sin ${dimension})"), elasticidad }
| sort category asc`;

/** Resumen ejecutivo: HPAs por elasticidad y tier. */
export const hpaElasticitySummary: QueryDef = {
  id: "elasticity.summary",
  module: "availability-risk",
  title: "Resumen por elasticidad y tier",
  description: "Cantidad de HPAs por estado de elasticidad y tier",
  window: snapshotWindow(
    "Foto del estado actual de los HorizontalPodAutoscalers (smartscape), sin histórico.",
  ),
  build: (params?: QueryParams) =>
    `${hpaElasticity.build(params)}\n| summarize hpas = count(), by:{prioridad, elasticidad, tier}\n| sort prioridad asc, tier asc\n| fields elasticidad, tier, hpas`,
};
