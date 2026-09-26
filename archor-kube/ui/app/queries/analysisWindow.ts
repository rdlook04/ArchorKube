import type { Lang, Localized } from "../i18n";

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
  /** Frase explicativa para el panel "Acerca de este módulo". */
  detail: Localized;
  /** Horas del rango móvil (solo para `range`); permite resolver el reloj. */
  hours?: number;
}

/** Etiqueta corta del badge ("Last 24 h" / "Últimas 24 h"), según el idioma. */
export const windowLabel = (window: AnalysisWindow, lang: Lang): string => {
  const es = lang === "es";
  if (window.kind === "snapshot") return es ? "Estado actual" : "Current state";
  if (window.kind === "catalog") return es ? "Catálogo" : "Catalog";
  const hours = window.hours ?? 0;
  const days = hours / 24;
  if (hours >= 24 && Number.isInteger(days) && days > 1) {
    return es ? `Últimos ${days} días` : `Last ${days} days`;
  }
  return es ? `Últimas ${hours} h` : `Last ${hours} h`;
};

/** Rango móvil sobre datos temporales (métricas, logs, eventos). */
export const rangeWindow = (hours: number, detail: Localized): AnalysisWindow => ({
  kind: "range",
  hours,
  detail,
});

/** Foto del estado actual (smartscape): no hay histórico, es lo que existe ahora. */
export const snapshotWindow = (detail: Localized): AnalysisWindow => ({
  kind: "snapshot",
  detail,
});

/** Catálogo o lookup sin dimensión temporal. */
export const catalogWindow = (detail: Localized): AnalysisWindow => ({
  kind: "catalog",
  detail,
});

const clockFormats: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  es: new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
};

/** Hora de reloj de una fecha, ej. "18 ago, 14:20" o "Aug 18, 14:20". */
export const formatClock = (at: Date, lang: Lang): string => clockFormats[lang].format(at);

/**
 * Resuelve el rango a horas de reloj concretas ("17 ago, 14:20 → 18 ago, 14:20"):
 * es la respuesta directa a "¿qué horas está mirando este módulo?".
 */
export const formatClockRange = (hours: number, until: Date, lang: Lang): string =>
  `${formatClock(new Date(until.getTime() - hours * 3600_000), lang)} → ${formatClock(until, lang)}`;
