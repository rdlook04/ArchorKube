/**
 * Ventana de datos que analiza cada módulo.
 *
 * Cada query mira un periodo distinto (2 h de métricas, 24 h de logs, 7 días
 * de tráfico, o la foto del estado actual de smartscape) y eso cambia por
 * completo cómo se lee un hallazgo. La ventana se declara junto a la query y
 * la página la muestra, para que nadie tenga que leer el DQL para saber qué
 * periodo está viendo.
 */
export type AnalysisWindowKind = "range" | "snapshot" | "catalog";

export interface AnalysisWindow {
  kind: AnalysisWindowKind;
  /** Etiqueta corta del badge, ej. "Últimas 24 h". */
  label: string;
  /** Frase explicativa para el panel "Acerca de este módulo". */
  detail: string;
  /** Horas del rango móvil (solo para `range`); permite resolver el reloj. */
  hours?: number;
}

const rangeLabel = (hours: number): string => {
  if (hours < 24) return `Últimas ${hours} h`;
  const days = hours / 24;
  if (days === 1) return "Últimas 24 h";
  return Number.isInteger(days) ? `Últimos ${days} días` : `Últimas ${hours} h`;
};

/** Rango móvil sobre datos temporales (métricas, logs, eventos). */
export const rangeWindow = (hours: number, detail: string): AnalysisWindow => ({
  kind: "range",
  hours,
  label: rangeLabel(hours),
  detail,
});

/** Foto del estado actual (smartscape): no hay histórico, es lo que existe ahora. */
export const snapshotWindow = (detail: string): AnalysisWindow => ({
  kind: "snapshot",
  label: "Estado actual",
  detail,
});

/** Catálogo o lookup sin dimensión temporal. */
export const catalogWindow = (detail: string): AnalysisWindow => ({
  kind: "catalog",
  label: "Catálogo",
  detail,
});

const clockFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Hora de reloj de una fecha, ej. "18 ago, 14:20". */
export const formatClock = (at: Date): string => clockFormat.format(at);

/**
 * Resuelve el rango a horas de reloj concretas ("17 ago, 14:20 → 18 ago, 14:20"):
 * es la respuesta directa a "¿qué horas está mirando este módulo?".
 */
export const formatClockRange = (hours: number, until: Date): string =>
  `${formatClock(new Date(until.getTime() - hours * 3600_000))} → ${formatClock(until)}`;
