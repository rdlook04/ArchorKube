import type { QueryDef } from "./types";
import { nodeSaturation, throttlingPeaks, throttlingSummary } from "./bottlenecks";
import { complianceReport, complianceSummary } from "./compliance";
import { nodeConditions, nodeHealthSummary } from "./controlplane";
import { nodeRightsizing, nodeRightsizingSummary } from "./density";
import { hpaElasticity, hpaElasticitySummary } from "./elasticity";
import { criticalErrors, criticalErrorsSummary } from "./errors";
import { idleSummary, idleWorkloads } from "./idle";
import { orphanSummary, orphanWorkloads } from "./orphans";
import { preventiveSignals, preventiveSummary } from "./preventive";
import { rightsizingReport, rightsizingSummary } from "./rightsizing";
import { workloadRisk, workloadRiskSummary } from "./risk";
import { tierByRepo, tierDistribution, tierLookup, tierSummary } from "./tiering";
import { tierPendingBySquad, tierPendingWorkloads } from "./tierPending";

export type { ModuleId, QueryDef, QueryParams } from "./types";
export {
  complianceReport,
  complianceSummary,
  criticalErrors,
  criticalErrorsSummary,
  hpaElasticity,
  hpaElasticitySummary,
  idleSummary,
  idleWorkloads,
  nodeConditions,
  nodeHealthSummary,
  nodeSaturation,
  orphanSummary,
  orphanWorkloads,
  preventiveSignals,
  preventiveSummary,
  throttlingPeaks,
  throttlingSummary,
  nodeRightsizing,
  nodeRightsizingSummary,
  rightsizingReport,
  rightsizingSummary,
  tierByRepo,
  tierPendingBySquad,
  tierPendingWorkloads,
  tierDistribution,
  tierLookup,
  tierSummary,
  workloadRisk,
  workloadRiskSummary,
};

/**
 * Registro central. Los módulos M1–M11 (SPEC §4) agregan aquí sus queries
 * a medida que se van entregando.
 */
export const queryRegistry: QueryDef[] = [
  tierLookup,
  tierByRepo,
  tierSummary,
  tierDistribution,
  rightsizingReport,
  rightsizingSummary,
  nodeRightsizing,
  nodeRightsizingSummary,
  hpaElasticity,
  hpaElasticitySummary,
  workloadRisk,
  workloadRiskSummary,
  idleWorkloads,
  idleSummary,
  orphanWorkloads,
  orphanSummary,
  preventiveSignals,
  preventiveSummary,
  criticalErrors,
  criticalErrorsSummary,
  nodeConditions,
  nodeHealthSummary,
  throttlingPeaks,
  throttlingSummary,
  nodeSaturation,
  complianceReport,
  complianceSummary,
];
