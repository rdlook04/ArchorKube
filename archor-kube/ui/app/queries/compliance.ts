import type { QueryDef, QueryParams } from "./types";
import { deploymentIdJoin } from "./links";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { snapshotWindow } from "./analysisWindow";
import { excludedNamespacesClause } from "./namespaces";
import { noneLabel, qx } from "./lang";

/**
 * M12 — Cumplimiento de estándar AKS (8 SPECs de buenas prácticas).
 *
 * Fuente: smartscapeNodes K8S_POD → se expande cada contenedor y se evalúan 8
 * especificaciones por workload (agregando todos sus contenedores):
 *   SPEC01 CPU Limit · SPEC02 Mem Limit · SPEC03 CPU Request · SPEC04 Mem Request
 *   SPEC05 Liveness Probe · SPEC06 Readiness Probe · SPEC07 Non-Root
 *   SPEC08 Desplegado por Helm
 *
 * Nivel de riesgo por spec (impacto en disponibilidad):
 *   🔴 SPEC06 Readiness / SPEC05 Liveness  → causa directa de caída
 *   🟠 SPEC02 Mem Limit / SPEC04 Mem Request → causa indirecta fuerte (OOM/scheduling)
 *   🟡 SPEC01 CPU Limit / SPEC03 CPU Request → degradación (throttling/scheduling), no caída
 *   ⚪ SPEC07 Non-Root → gate de seguridad, no de disponibilidad
 *   ⚪ SPEC08 Helm → trazabilidad del despliegue, no de disponibilidad
 * Prioridad: SPEC06 → SPEC05 → SPEC02/04 → SPEC01/03 → SPEC07 → SPEC08.
 *
 * v1 sobre el molde M3 (2026-07-14): se agrega tier/squad/tribu del catálogo
 * la capa de propiedad (join por nombre de workload) + filtros transversales, veredicto de
 * criticidad, deep link al workload y % de cumplimiento por fila.
 */

/**
 * SPEC08 — desplegado por Helm.
 *
 * Query aportada por el usuario (2026-08-19): Helm marca lo que crea con la
 * etiqueta `app.kubernetes.io/managed-by = Helm`. Lo que no la trae salió de un
 * despliegue manual o quedó de la infraestructura anterior, y es justo lo que
 * suele aparecer con el limit descuadrado respecto del request en M1/M2.
 *
 * Igual que `deploymentIdJoin`, la unión es por nombre de workload: si el mismo
 * nombre corre en dos clústeres, basta con que uno venga de Helm para marcarlo.
 */
const helmManagedJoin = `| lookup [
    smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET, K8S_DAEMONSET, K8S_JOB, K8S_CRONJOB
    | filter tags[\`app.kubernetes.io/managed-by\`] == "Helm"
    | fieldsAdd helm_managed = "SI"
    | fields k8s.workload.name, helm_managed
    | limit 10000
  ], sourceField:\`k8s.workload.name\`, lookupField:\`k8s.workload.name\`, fields:{helm_managed}`;

/**
 * Base compartida: evalúa las 7 specs por workload y clasifica su criticidad.
 * Deja disponibles los contadores `sin_*` para que el resumen por-spec y la
 * gráfica puedan reagrupar, y aplica el join de tier + los filtros transversales.
 * NO incluye `| fields` final para poder extenderse.
 */
const complianceByWorkload = (params?: QueryParams): string => `smartscapeNodes K8S_POD
| parse k8s.object, "JSON:config"
| expand container = config[\`spec\`][\`containers\`]
| fieldsAdd
    cpu_limit       = container[\`resources\`][\`limits\`][\`cpu\`],
    memory_limit    = container[\`resources\`][\`limits\`][\`memory\`],
    cpu_request     = container[\`resources\`][\`requests\`][\`cpu\`],
    memory_request  = container[\`resources\`][\`requests\`][\`memory\`],
    liveness_probe  = container[\`livenessProbe\`],
    readiness_probe = container[\`readinessProbe\`],
    run_as_non_root = container[\`securityContext\`][\`runAsNonRoot\`],
    run_as_user     = container[\`securityContext\`][\`runAsUser\`]
${excludedNamespacesClause()}
| summarize
    total           = count(),
    sin_cpu_limit   = countIf(isNull(cpu_limit)),
    sin_mem_limit   = countIf(isNull(memory_limit)),
    sin_cpu_req     = countIf(isNull(cpu_request)),
    sin_mem_req     = countIf(isNull(memory_request)),
    sin_liveness    = countIf(isNull(liveness_probe)),
    sin_readiness   = countIf(isNull(readiness_probe)),
    root_containers = countIf((isNull(run_as_user) or run_as_user == 0) and run_as_non_root != true),
    by: {k8s.cluster.name, k8s.namespace.name, k8s.workload.name}
${helmManagedJoin}
| fieldsAdd sin_helm = if(isNull(helm_managed), 1, else: 0)
| fieldsAdd
    cumplimiento_pct = round((
        if(sin_cpu_limit==0,1,else:0) +
        if(sin_mem_limit==0,1,else:0) +
        if(sin_cpu_req==0,1,else:0)   +
        if(sin_mem_req==0,1,else:0)   +
        if(sin_liveness==0,1,else:0)  +
        if(sin_readiness==0,1,else:0) +
        if(root_containers==0,1,else:0) +
        if(sin_helm==0,1,else:0)
    ) * 100.0 / 8, decimals:0),
    spec01 = if(sin_cpu_limit   == 0, "${qx(params, "✅ Meets", "✅ Cumple")}", else: "${qx(params, "❌ Misses", "❌ No cumple")}"),
    spec02 = if(sin_mem_limit   == 0, "${qx(params, "✅ Meets", "✅ Cumple")}", else: "${qx(params, "❌ Misses", "❌ No cumple")}"),
    spec03 = if(sin_cpu_req     == 0, "${qx(params, "✅ Meets", "✅ Cumple")}", else: "${qx(params, "❌ Misses", "❌ No cumple")}"),
    spec04 = if(sin_mem_req     == 0, "${qx(params, "✅ Meets", "✅ Cumple")}", else: "${qx(params, "❌ Misses", "❌ No cumple")}"),
    spec05 = if(sin_liveness    == 0, "${qx(params, "✅ Meets", "✅ Cumple")}", else: "${qx(params, "❌ Misses", "❌ No cumple")}"),
    spec06 = if(sin_readiness   == 0, "${qx(params, "✅ Meets", "✅ Cumple")}", else: "${qx(params, "❌ Misses", "❌ No cumple")}"),
    spec07 = if(root_containers == 0, "${qx(params, "✅ Meets", "✅ Cumple")}", else: "${qx(params, "❌ Misses", "❌ No cumple")}"),
    spec08 = if(sin_helm        == 0, "✅ Helm",   else: "${qx(params, "❌ No Helm", "❌ Sin Helm")}")
| fieldsAdd
    criticidad = if(sin_readiness > 0 or sin_liveness > 0, "RIESGO_DISPONIBILIDAD",
                 else: if(sin_mem_limit > 0 or sin_mem_req > 0, "RIESGO_RECURSOS",
                 else: if(sin_cpu_limit > 0 or sin_cpu_req > 0, "AJUSTE_MENOR",
                 else: if(root_containers > 0, "SOLO_SEGURIDAD",
                 else: if(sin_helm > 0, "SIN_HELM",
                 else: "CUMPLE_TODO"))))),
    prioridad = if(sin_readiness > 0 or sin_liveness > 0, 1,
                else: if(sin_mem_limit > 0 or sin_mem_req > 0, 2,
                else: if(sin_cpu_limit > 0 or sin_cpu_req > 0, 3,
                else: if(root_containers > 0, 4,
                else: if(sin_helm > 0, 5, else: 6)))))
${tierLookupJoin("k8s.workload.name")}${tierFilterClause(params)}`;

/** Detalle por workload con las 8 specs, criticidad y deep link. */
export const complianceReport: QueryDef = {
  id: "compliance.report",
  module: "compliance",
  title: { en: "AKS standard compliance by workload (8 SPECs)", es: "Cumplimiento del estándar AKS por workload (8 SPECs)" },
  description:
    { en: "Checks CPU/memory limits and requests, liveness/readiness probes and non-root per workload", es: "Evalúa CPU/Mem limits+requests, liveness/readiness probes y non-root por workload" },
  window: snapshotWindow(
    { en: "Snapshot of the current topology (smartscape): the 8 SPECs are checked against each workload's current manifest.", es: "Foto del estado actual de la topología (smartscape): las 8 SPECs se evalúan sobre el manifiesto vigente de cada workload." },
  ),
  build: (params?: QueryParams) => `${complianceByWorkload(params)}
${deploymentIdJoin("`k8s.workload.name`")}
| sort prioridad asc, cumplimiento_pct asc
| fields k8s.cluster.name, k8s.namespace.name, k8s.workload.name,
    tier, squad, tribu, criticidad, cumplimiento_pct,
    spec06, spec05, spec02, spec04, spec01, spec03, spec07, spec08,
    prioridad, deployment_id`,
};

/** Dimensión del eje de la gráfica categórica de criticidad. */
export type BreakdownDimension = "tier" | "squad" | "tribu";

/**
 * Conteo de workloads por criticidad agrupado por una dimensión (tier/squad/
 * tribu). Alimenta el CategoricalBarChart apilado del resumen.
 */
export const complianceBreakdown = (
  dimension: BreakdownDimension,
  params?: QueryParams,
): string =>
  `${complianceByWorkload(params)}
| summarize workloads = count(), by:{ category = coalesce(${dimension}, "${noneLabel(dimension, params)}"), criticidad }
| sort category asc`;

/**
 * Dashboard ejecutivo: por cada una de las 8 specs, cuántos workloads cumplen
 * y cuántos no, con su % de incumplimiento y un estado semafórico. Es la vista
 * "¿qué spec es la que más incumplimos?" para la imagen general del módulo.
 */
export const complianceSummary: QueryDef = {
  id: "compliance.summary",
  module: "compliance",
  title: { en: "Compliance by spec (overview)", es: "Cumplimiento por especificación (dashboard general)" },
  description: { en: "Workloads that meet or miss each of the 8 SPECs of the AKS standard", es: "Workloads que cumplen/incumplen cada una de las 8 SPECs del estándar AKS" },
  window: snapshotWindow(
    { en: "Snapshot of the current topology (smartscape), no history.", es: "Foto del estado actual de la topología (smartscape), sin histórico." },
  ),
  build: (params?: QueryParams) => `${complianceByWorkload(params)}
| summarize
    total            = count(),
    no_cumple_spec01 = countIf(sin_cpu_limit    > 0),
    no_cumple_spec02 = countIf(sin_mem_limit    > 0),
    no_cumple_spec03 = countIf(sin_cpu_req      > 0),
    no_cumple_spec04 = countIf(sin_mem_req      > 0),
    no_cumple_spec05 = countIf(sin_liveness     > 0),
    no_cumple_spec06 = countIf(sin_readiness    > 0),
    no_cumple_spec07 = countIf(root_containers  > 0),
    no_cumple_spec08 = countIf(sin_helm         > 0)
| fieldsAdd specs = array(
    array("SPEC06 Readiness Probe", no_cumple_spec06),
    array("SPEC05 Liveness Probe",  no_cumple_spec05),
    array("SPEC02 Memory Limit",    no_cumple_spec02),
    array("SPEC04 Memory Request",  no_cumple_spec04),
    array("SPEC01 CPU Limit",       no_cumple_spec01),
    array("SPEC03 CPU Request",     no_cumple_spec03),
    array("SPEC07 Non-Root",        no_cumple_spec07),
    array("SPEC08 Helm",            no_cumple_spec08)
  )
| expand specs
| fieldsAdd
    no_cumple = toLong(specs[1]),
    cumple    = total - toLong(specs[1])
| fieldsAdd
    spec               = specs[0],
    cumplimiento_pct   = round(cumple    * 100.0 / total, decimals: 1),
    incumplimiento_pct = round(no_cumple * 100.0 / total, decimals: 1),
    estado             = if(no_cumple == 0,                        "✅ OK",
                         else: if(no_cumple * 100.0 / total > 50,  "${qx(params, "🔴 Critical", "🔴 Crítico")}",
                         else: if(no_cumple * 100.0 / total > 10,  "${qx(params, "🟡 Warning", "🟡 Alerta")}",
                         else:                                     "${qx(params, "🟠 Review", "🟠 Revisar")}")))
| fields spec, cumple, no_cumple, cumplimiento_pct, incumplimiento_pct, estado
| sort incumplimiento_pct desc`,
};
