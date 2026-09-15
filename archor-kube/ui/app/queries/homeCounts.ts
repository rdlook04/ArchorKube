import { complianceReport } from "./compliance";
import { criticalErrors } from "./errors";
import { hpaElasticity } from "./elasticity";
import { idleWorkloads } from "./idle";
import { nodeConditions } from "./controlplane";
import { nodeRightsizing } from "./density";
import { orphanWorkloads } from "./orphans";
import { preventiveSignals } from "./preventive";
import { rightsizingReport } from "./rightsizing";
import { throttlingPeaks } from "./bottlenecks";
import { tierByRepo } from "./tiering";
import { tierPendingWorkloads } from "./tierPending";
import { workloadRisk } from "./risk";
import type { AnalysisWindow } from "./analysisWindow";
import type { QueryDef } from "./types";

/**
 * Contadores de la portada.
 *
 * Cada tarjeta del Home ejecuta el mismo pipeline del módulo cerrado con un
 * `summarize` de una sola fila: así el número de la portada es exactamente el
 * que el usuario encuentra al entrar al módulo, sin una segunda definición de
 * "hallazgo" que se pueda desincronizar.
 */
export interface HomeMetric {
  /** Filas que devuelve el módulo (sus hallazgos abiertos). */
  hallazgos: number;
  /** Filas de máxima prioridad dentro de ese total. */
  criticos: number;
  /** Dinero al mes asociado, solo en los módulos que valorizan el desperdicio. */
  usd?: number;
  /** Cumplimiento promedio, solo en M12. */
  pct?: number;
}

/** Cierra el pipeline del módulo con un `summarize` de una fila. */
const countOf = (query: QueryDef, ...extra: string[]): string =>
  `${query.build()}\n| summarize hallazgos = count()${extra.map((e) => `, ${e}`).join("")}`;

/**
 * `prioridad == 1` es el peor escalón en todos los módulos que la definen
 * (throttling crítico, ocioso confirmado, OOM kill, …). Riesgo usa `nivel` y
 * control plane no clasifica: toda condición reportada ya es un problema.
 */
export const HOME_COUNT_QUERIES: Record<string, string> = {
  "/rightsizing": countOf(
    rightsizingReport,
    "criticos = countIf(prioridad == 1)",
    "usd = round(sum(perdida_mes_usd), decimals:0)",
  ),
  "/nodes": countOf(
    nodeRightsizing,
    "criticos = countIf(prioridad == 1)",
    "usd = round(sum(ahorro_mes_usd), decimals:0)",
  ),
  "/idle": countOf(
    idleWorkloads,
    "criticos = countIf(prioridad == 1)",
    "usd = round(sum(perdida_mes_usd), decimals:0)",
  ),
  "/risk": countOf(workloadRisk, 'criticos = countIf(nivel == "CRITICO")'),
  "/preventive": countOf(preventiveSignals, "criticos = countIf(prioridad == 1)"),
  "/errors": countOf(criticalErrors, "criticos = countIf(prioridad == 1)"),
  "/bottlenecks": countOf(throttlingPeaks, "criticos = countIf(prioridad == 1)"),
  "/elasticity": countOf(hpaElasticity, "criticos = countIf(prioridad == 1)"),
  "/control-plane": countOf(nodeConditions, "criticos = count()"),
  "/compliance": countOf(
    complianceReport,
    "criticos = countIf(prioridad == 1)",
    "pct = round(avg(cumplimiento_pct), decimals:0)",
  ),
  "/orphans": countOf(orphanWorkloads, "criticos = countIf(prioridad == 1)"),
  "/tiers": countOf(tierByRepo),
  "/tier-pending": countOf(
    tierPendingWorkloads,
    'criticos = countIf(motivo == "FALTA_DUENO")',
  ),
};

/** Grail serializa enteros como string; normaliza el registro a números. */
export const toHomeMetric = (record: Record<string, unknown>): HomeMetric => {
  const num = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    hallazgos: num(record.hallazgos) ?? 0,
    criticos: num(record.criticos) ?? 0,
    usd: num(record.usd),
    pct: num(record.pct),
  };
};

/** Ventana de datos de cada módulo, para mostrarla en su tarjeta del Home. */
export const HOME_WINDOWS: Record<string, AnalysisWindow | undefined> = {
  "/rightsizing": rightsizingReport.window,
  "/nodes": nodeRightsizing.window,
  "/idle": idleWorkloads.window,
  "/risk": workloadRisk.window,
  "/preventive": preventiveSignals.window,
  "/errors": criticalErrors.window,
  "/bottlenecks": throttlingPeaks.window,
  "/elasticity": hpaElasticity.window,
  "/control-plane": nodeConditions.window,
  "/compliance": complianceReport.window,
  "/orphans": orphanWorkloads.window,
  "/tiers": tierByRepo.window,
  "/tier-pending": tierPendingWorkloads.window,
};
