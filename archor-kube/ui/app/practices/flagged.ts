import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { PRACTICES, practiceByCode } from "./catalog";

type Row = Record<string, unknown>;

/**
 * De cada fila de un módulo a las prácticas del catálogo que explica.
 *
 * Vive junto al catálogo y no en cada página para que la traducción
 * "etiqueta del módulo → práctica" se lea en un solo lugar: si cambia el
 * nombre de una etiqueta en una query, se corrige aquí.
 */

/** Ordena por prioridad del catálogo y quita duplicados. */
const inCatalogOrder = (ids: string[]): string[] =>
  PRACTICES.filter((p) => ids.includes(p.id)).map((p) => p.id);

/** M12: columnas spec01…spec08 con "✅ …" o "❌ …". */
export const compliancePractices = (row: Row): string[] => {
  const ids: string[] = [];
  for (let n = 1; n <= 8; n++) {
    const value = row[`spec0${n}`];
    const practice = practiceByCode(`SPEC0${n}`);
    if (practice && typeof value === "string" && value.startsWith("❌")) ids.push(practice.id);
  }
  return inCatalogOrder(ids);
};

/** M5 Riesgo: réplica única y probes faltantes suman al mismo score. */
export const riskPractices = (row: Row): string[] =>
  inCatalogOrder([
    ...(row.single_replica === "SI" ? ["multiple-replicas"] : []),
    ...(row.readiness_gap === "FALTA" ? ["readiness-probe"] : []),
    ...(row.liveness_gap === "FALTA" ? ["liveness-probe"] : []),
  ]);

/** M5 Elasticidad: cualquier HPA marcado (topado o min = max). */
export const elasticityPractices = (row: Row): string[] =>
  row.elasticidad && row.elasticidad !== "OK" ? ["autoscaler-headroom"] : [];

/** M1/M2: el throttling también es un problema de CPU limit. */
export const rightsizingPractices = (row: Row): string[] => {
  const problem = typeof row.problema === "string" ? row.problema : "";
  if (!problem || problem === "OK") return [];
  return inCatalogOrder([
    "right-sized-requests",
    ...(problem === "THROTTLING_CRITICO" ? ["cpu-limit"] : []),
  ]);
};

/**
 * M3: solo los veredictos "OCIOSO…". Un descartado por tráfico no incumple
 * nada, y uno descartado por inestable es un problema de estabilidad.
 */
export const idlePractices = (row: Row): string[] => {
  const verdict = typeof row.veredicto === "string" ? row.veredicto : "";
  if (verdict.startsWith("OCIOSO")) return ["no-idle-workloads"];
  if (verdict === "DESCARTADO_INESTABLE") return ["stable-containers"];
  return [];
};

/** M6: réplicas en cero o sin dueño en el catálogo. */
export const orphanPractices = (row: Row): string[] =>
  typeof row.motivo === "string" && row.motivo !== "" && row.motivo !== "OK"
    ? ["owned-workloads"]
    : [];

/**
 * M8: un OOM también es un tema de límite de memoria; un restart loop suele
 * ser una liveness mal calibrada.
 */
export const preventivePractices = (row: Row): string[] => {
  const signal = typeof row.senal === "string" ? row.senal : "";
  if (!signal) return [];
  return inCatalogOrder([
    "stable-containers",
    ...(signal === "OOM_KILL" ? ["memory-limit"] : ["liveness-probe"]),
  ]);
};

/**
 * Abre la Guía con esas prácticas primero y abiertas. El nombre del workload
 * es solo para el título del aviso ("Why is X flagged?").
 */
export const useOpenGuide = () => {
  const navigate = useNavigate();
  return useCallback(
    (practiceIds: string[], row: Row) => {
      const query = new URLSearchParams({ focus: practiceIds.join(",") });
      const name = row["k8s.workload.name"] ?? row.hpa_name;
      if (typeof name === "string" && name) query.set("workload", name);
      navigate(`/guide?${query.toString()}`);
    },
    [navigate],
  );
};
