import type { Lang, Localized } from "./index";

/**
 * Texto legible de los códigos que arman las consultas (OCIOSO_CONFIRMADO,
 * THROTTLING_CRITICO…).
 *
 * Los códigos son el contrato de las consultas: los usan los colores de las
 * tablas, "¿Por qué se marca?", los prompts y el orden de prioridad, así que
 * no cambian. Solo cambia lo que se muestra: tablas, filtros y leyendas de las
 * gráficas pasan cada valor por `codeLabel`. Un código sin entrada aquí se
 * muestra tal cual.
 *
 * Los niveles de log (ERROR, FATAL, CRITICAL…) no están: son estándar y se
 * leen igual en los dos idiomas.
 */
export const CODE_LABELS: Record<string, Localized> = {
  // Ociosos (M3)
  OCIOSO_CONFIRMADO: { en: "Confirmed idle", es: "Ocioso confirmado" },
  OCIOSO_SIN_DATO_APM: { en: "Idle, no APM data", es: "Ocioso sin dato de APM" },
  DESCARTADO_CON_TRAFICO: { en: "Ruled out: has traffic", es: "Descartado: tiene tráfico" },
  DESCARTADO_INESTABLE: { en: "Ruled out: unstable", es: "Descartado: inestable" },
  OCIOSO: { en: "Idle", es: "Ocioso" },
  MUERTO: { en: "No CPU at all", es: "Sin CPU" },
  ACTIVO: { en: "Active", es: "Activo" },
  POR_ENCIMA: { en: "Above reservation", es: "Por encima de la reserva" },
  AL_LIMITE: { en: "At the limit", es: "Al límite" },
  AJUSTADO: { en: "Well sized", es: "Ajustado" },
  HOLGADO: { en: "Oversized", es: "Holgado" },
  SIN_RESERVA: { en: "No reservation", es: "Sin reserva" },

  // Rightsizing (M1/M2)
  THROTTLING_CRITICO: { en: "Critical throttling", es: "Throttling crítico" },
  SOBREAPROVISIONADO_CPU: { en: "Over-provisioned CPU", es: "CPU sobreaprovisionada" },
  SOBREAPROVISIONADO_MEM: { en: "Over-provisioned memory", es: "Memoria sobreaprovisionada" },
  SOBREAPROVISIONADO_CPU_MEM: {
    en: "Over-provisioned CPU and memory",
    es: "CPU y memoria sobreaprovisionadas",
  },
  REQUEST_SUBDIMENSIONADO: { en: "Requests below usage", es: "Requests por debajo del uso" },
  REVISAR: { en: "Review", es: "Revisar" },

  // Nodos (M4)
  CANDIDATO_ELIMINAR: { en: "Candidate to remove", es: "Candidato a eliminar" },
  CONSOLIDAR_SI_ES_POSIBLE: { en: "Consolidate if possible", es: "Consolidar si es posible" },
  MONITOREAR: { en: "Monitor", es: "Monitorear" },

  // Riesgo y niveles compartidos
  CRITICO: { en: "Critical", es: "Crítico" },
  ALTO: { en: "High", es: "Alto" },
  MEDIO: { en: "Medium", es: "Medio" },
  FALTA: { en: "Missing", es: "Falta" },
  SI: { en: "Yes", es: "Sí" },
  NO: { en: "No", es: "No" },

  // Elasticidad (M5)
  BLOQUEADO_NECESITA_MAX: { en: "Capped: needs a higher max", es: "Topado: necesita más máximo" },
  SIN_MARGEN_MIN_ES_MAX: { en: "No headroom (min = max)", es: "Sin margen (mín = máx)" },

  // Huérfanos y tier pendiente (M6)
  REPLICAS_0: { en: "Scaled to 0", es: "Escalado a 0" },
  SIN_DUENO: { en: "No owner", es: "Sin dueño" },
  FALTA_DUENO: { en: "Missing owner", es: "Falta dueño" },
  ASIGNAR_TIER: { en: "Assign a tier", es: "Asignar tier" },

  // Preventiva (M8)
  OOM_KILL: { en: "OOM kill", es: "OOM kill" },
  RESTART_LOOP: { en: "Restart loop", es: "Bucle de reinicios" },
  RESTARTS_ELEVADOS: { en: "Frequent restarts", es: "Reinicios frecuentes" },

  // Errores (M9)
  CON_CRITICOS: { en: "With criticals", es: "Con críticos" },
  SOLO_ERRORES: { en: "Errors only", es: "Solo errores" },

  // Cuellos de botella (M11)
  SEVERO: { en: "Severe", es: "Severo" },
  MODERADO: { en: "Moderate", es: "Moderado" },

  // Cumplimiento (M12)
  RIESGO_DISPONIBILIDAD: { en: "Availability risk", es: "Riesgo de disponibilidad" },
  RIESGO_RECURSOS: { en: "Resource risk", es: "Riesgo de recursos" },
  AJUSTE_MENOR: { en: "Minor adjustment", es: "Ajuste menor" },
  SOLO_SEGURIDAD: { en: "Security only", es: "Solo seguridad" },
  SIN_HELM: { en: "No Helm", es: "Sin Helm" },
  CUMPLE_TODO: { en: "Meets everything", es: "Cumple todo" },

  // Gasto (M13)
  NUEVO: { en: "New (< 7 days)", es: "Nuevo (< 7 días)" },
  RECIENTE: { en: "Recent (7–27 days)", es: "Reciente (7–27 días)" },
  VETERANO: { en: "Long-lived (28+ days)", es: "Veterano (28+ días)" },
};

/** El texto de un valor si es un código conocido; si no, el valor sin tocar. */
export const codeLabel = <T,>(value: T, lang: Lang): T | string =>
  typeof value === "string" && Object.hasOwn(CODE_LABELS, value) ? CODE_LABELS[value][lang] : value;

/** Copia de la fila con cada código reemplazado por su texto. */
export const labelRow = (row: Record<string, unknown>, lang: Lang): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, codeLabel(value, lang)]));

/** Paleta de una gráfica con sus claves (códigos) pasadas a texto. */
export const labelPalette = (palette: Record<string, string>, lang: Lang): Record<string, string> =>
  Object.fromEntries(
    Object.entries(palette).map(([code, color]) => [codeLabel(code, lang), color]),
  );
