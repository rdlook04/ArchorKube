/**
 * Registro tipado de consultas DQL de ArchorKube.
 * Cada módulo (M1–M11 en docs/SPEC.md) aporta sus queries como QueryDef,
 * de forma que las páginas solo consumen el registro y nunca strings sueltos.
 */
import type { Localized } from "../i18n";
import type { AnalysisWindow } from "./analysisWindow";

export type ModuleId =
  | "diagnostics"
  | "rightsizing-cpu"
  | "rightsizing-memory"
  | "idle"
  | "density"
  | "availability-risk"
  | "orphans"
  | "tiering"
  | "preventive"
  | "critical-errors"
  | "control-plane"
  | "bottlenecks"
  | "compliance"
  | "spend";

export interface QueryParams {
  /** Timeframe DQL, ej. "now()-2h". Los módulos pueden ignorarlo si la query trae el suyo. */
  from?: string;
  /** Filtro opcional de namespaces (se interpola solo si la query lo soporta). */
  namespaces?: string[];
  /** Selectores transversales (catálogo de propiedad). */
  tier?: string;
  squad?: string;
  tribu?: string;
  /** Filtro por clúster K8s (k8s.cluster.name). */
  cluster?: string;
  /** Filtro por namespace (k8s.namespace.name). */
  namespace?: string;
  /** Filtros opcionales por label, por id de `EXTRA_FILTERS` → valor elegido. */
  extra?: Record<string, string>;
}

export interface QueryDef {
  id: string;
  module: ModuleId;
  title: Localized;
  description: Localized;
  /** Construye el string DQL final a partir de los parámetros. */
  build: (params?: QueryParams) => string;
  /** Periodo de datos que analiza la query (se muestra en la página). */
  window?: AnalysisWindow;
}
