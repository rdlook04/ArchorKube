import type { QueryDef, QueryParams } from "./types";
import { tierFilterClause, tierLookupJoin } from "./tierJoin";
import { snapshotWindow } from "./analysisWindow";
import { excludedNamespacesClause } from "./namespaces";

/**
 * M7 — Pendientes de tieraje.
 *
 * Los workloads que corren sin tier. No es un hallazgo técnico: es la deuda que
 * impide priorizar todo lo demás. Un workload sin tier queda al fondo de la
 * cola de cada módulo, no porque esté sano sino porque nadie declaró cuánto
 * importa.
 *
 * Se separa en dos casos porque la acción es distinta y el dueño de la acción
 * también:
 *
 *  - `ASIGNAR_TIER`: el squad ya se conoce. Es repartible hoy mismo — ese
 *    equipo declara el tier y listo.
 *  - `FALTA_DUENO`: no hay ni squad. No se puede repartir: primero hay que
 *    averiguar de quién es, y recién después pedir el tier.
 *
 * Mezclarlos daría una lista que nadie puede accionar, porque la mitad no
 * tiene a quién mandarse.
 */

/** Base común: workloads vivos, enriquecidos, sin tier. */
const PENDING_BASE = (params?: QueryParams): string =>
  `smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET
| fieldsAdd deployment_id = id
${excludedNamespacesClause()}
${tierLookupJoin("k8s.workload.name")}
| filter isNull(tier)${tierFilterClause(params)}
| fieldsAdd motivo = if(isNotNull(squad), "ASIGNAR_TIER", else: "FALTA_DUENO")
| fieldsAdd prioridad = if(isNotNull(squad), 1, else: 2)`;

const WINDOW = snapshotWindow(
  { en: "Snapshot of the current state: the workloads defined right now and ownership as it's declared today in the catalog and labels.", es: "Foto del estado actual: los workloads definidos ahora mismo y la propiedad tal como está declarada hoy en el catálogo y en las labels." },
);

/**
 * El reparto: cuántos pendientes le tocan a cada squad.
 *
 * Ordenado por volumen porque es una cola de trabajo — el squad con 50
 * pendientes es el que mueve la aguja, no el que tiene 1.
 */
export const tierPendingBySquad: QueryDef = {
  id: "tier-pending.by-squad",
  module: "tiering",
  title: { en: "Pending tiers by squad", es: "Pendientes de tier por squad" },
  description:
    { en: "How many untiered workloads belong to each squad, to split the work", es: "Cuántos workloads sin tier le corresponden a cada squad, para repartir el trabajo" },
  window: WINDOW,
  build: (params?: QueryParams) => `${PENDING_BASE(params)}
| summarize pendientes = count(),
    sin_dueno = countIf(motivo == "FALTA_DUENO"),
    by:{ squad = coalesce(squad, "(sin dueño)"), tribu = coalesce(tribu, "—") }
| sort pendientes desc`,
};

/** El detalle: qué workloads exactamente, para que cada squad los reconozca. */
export const tierPendingWorkloads: QueryDef = {
  id: "tier-pending.workloads",
  module: "tiering",
  title: { en: "Workloads without a tier", es: "Workloads sin tier" },
  description:
    { en: "Every workload running without a declared tier, with the squad to ask", es: "Cada workload que corre sin tier declarado, con el squad al que hay que reclamárselo" },
  window: WINDOW,
  build: (params?: QueryParams) => `${PENDING_BASE(params)}
| sort prioridad asc, k8s.namespace.name asc, k8s.workload.name asc
| fields k8s.cluster.name, k8s.namespace.name, k8s.workload.name, k8s.workload.kind,
    squad, tribu, appCode, motivo, prioridad, deployment_id`,
};

/** Dimensión del eje de la gráfica categórica. */
export type PendingDimension = "squad" | "tribu";

/**
 * Conteo por motivo agrupado por squad o tribu, para la gráfica del resumen.
 * Sin tier como dimensión, obviamente: aquí el tier es justo lo que falta.
 */
export const tierPendingBreakdown = (
  dimension: PendingDimension = "squad",
): QueryDef => ({
  id: `tier-pending.breakdown.${dimension}`,
  module: "tiering",
  title: {
    en: `Pending tiers by ${dimension === "squad" ? "squad" : "tribe"}`,
    es: `Pendientes de tier por ${dimension}`,
  },
  description: { en: "Pending workloads by reason", es: "Distribución de los pendientes por motivo" },
  window: WINDOW,
  build: (params?: QueryParams) => `${PENDING_BASE(params)}
| summarize workloads = count(),
    by:{ category = coalesce(${dimension}, "(sin dato)"), motivo }
| sort workloads desc`,
});
