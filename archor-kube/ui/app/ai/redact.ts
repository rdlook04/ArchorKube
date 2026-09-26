/**
 * Filtro de datos para todo lo que sale de Dynatrace hacia una IA externa
 * (Ollama por el puente, Claude/Gemini/JEV por copiar, lo que venga).
 *
 * Nada que vaya afuera se arma sin pasar por `redactForExternal`. Assist no
 * pasa por aquí: corre dentro del tenant y recibe la fila completa.
 *
 * Dos capas, porque una sola no alcanza:
 *  1. La fila: antes de armar el prompt se quitan o reemplazan los campos
 *     sensibles, así el texto nunca los tiene.
 *  2. El texto: después de armarlo se busca cada valor real que se quitó y se
 *     reemplaza donde aparezca. Cubre los campos libres (un mensaje de log que
 *     nombra el cluster, un pod cuyo nombre contiene el del workload).
 */

/**
 * - `placeholders`: los nombres de Kubernetes salen como $NS, $WL…; la IA arma
 *   los comandos con variables y el usuario los completa en su terminal.
 * - `real`: los nombres de Kubernetes salen reales (con advertencia antes de
 *   cada envío). Lo que identifica a la organización no sale en ningún modo.
 */
export type DataMode = "placeholders" | "real";

/** Nombres de Kubernetes: reales en modo `real`, variables en `placeholders`. */
const K8S_NAMES: ReadonlyArray<readonly [field: string, placeholder: string]> = [
  ["k8s.namespace.name", "$NS"],
  ["k8s.workload.name", "$WL"],
  ["k8s.pod.name", "$POD"],
  ["k8s.container.name", "$CONTAINER"],
  ["k8s.node.name", "$NODE"],
  ["hpa_name", "$HPA"],
];

/** El nombre del cluster identifica a la organización: nunca sale. */
const CLUSTER_FIELD = "k8s.cluster.name";
const CLUSTER_PLACEHOLDER = "<kube-context>";

/**
 * Campos que no salen en ningún modo: dueño organizacional, plata e
 * identificadores o links del tenant. Se evalúa por nombre de campo para que
 * un módulo nuevo quede cubierto sin tocar esta lista.
 */
const NEVER_EXPORT: readonly RegExp[] = [
  /^(squad|tribu|tribe|appCode|app_code|owner|team)$/i,
  /usd/i,
  /(^|[._])(id|url)$/i,
];

/** Patrones que se limpian del texto final aunque no vengan de un campo conocido. */
const TEXT_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/https?:\/\/[^\s;,)]*dynatrace[^\s;,)]*/gi, "<tenant-url>"],
  [/\b[a-z0-9]{8}\.(?:live|apps|sprint|dev)\.[a-z.]*dynatrace[a-z.]*\b/gi, "<tenant>"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<ip>"],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "<email>"],
];

type Row = Record<string, unknown>;

interface Replacement {
  value: string;
  placeholder: string;
}

export interface RedactedPrompt {
  text: string;
  mode: DataMode;
  /** Qué se reemplazó, para mostrarlo en la vista previa (sin los valores). */
  replaced: string[];
}

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Reemplaza el valor solo como palabra completa dentro de un nombre de
 * Kubernetes, para que un namespace "app" no rompa la palabra "application".
 */
const replaceWhole = (text: string, { value, placeholder }: Replacement): string =>
  text.replace(
    new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(value)}(?=$|[^A-Za-z0-9_-])`, "g"),
    (_m, before: string) => `${before}${placeholder}`,
  );

/** Capa 1: copia de la fila sin lo que no debe salir. */
const redactRow = (row: Row, mode: DataMode): { safe: Row; replacements: Replacement[] } => {
  const safe: Row = {};
  const replacements: Replacement[] = [];

  for (const [key, value] of Object.entries(row)) {
    if (NEVER_EXPORT.some((re) => re.test(key))) {
      const text = asText(value);
      if (text) replacements.push({ value: text, placeholder: "<redacted>" });
      continue;
    }
    safe[key] = value;
  }

  const cluster = asText(row[CLUSTER_FIELD]);
  if (cluster) {
    safe[CLUSTER_FIELD] = CLUSTER_PLACEHOLDER;
    replacements.push({ value: cluster, placeholder: CLUSTER_PLACEHOLDER });
  }

  if (mode === "placeholders") {
    for (const [field, placeholder] of K8S_NAMES) {
      const value = asText(row[field]);
      if (!value) continue;
      safe[field] = placeholder;
      replacements.push({ value, placeholder });
    }
  }

  // Primero los valores más largos: el pod "api-7d9f" antes que el workload "api".
  replacements.sort((a, b) => b.value.length - a.value.length);
  return { safe, replacements };
};

/**
 * Arma el prompt con `build` sobre la fila ya filtrada y limpia el texto
 * resultante. Es la única puerta de salida hacia IAs fuera de Dynatrace.
 */
export const redactForExternal = (
  build: (row: Row) => string,
  row: Row,
  mode: DataMode,
): RedactedPrompt => {
  const { safe, replacements } = redactRow(row, mode);
  let text = build(safe);

  // Todo campo quitado de la fila cuenta como reemplazado, aparezca o no en el texto.
  const replaced = new Set<string>(replacements.map((r) => r.placeholder));
  for (const r of replacements) text = replaceWhole(text, r);
  for (const [pattern, placeholder] of TEXT_PATTERNS) {
    const next = text.replace(pattern, placeholder);
    if (next !== text) replaced.add(placeholder);
    text = next;
  }

  if (mode === "placeholders" && [...replaced].some((p) => p.startsWith("$"))) {
    text +=
      "\n\nNote: $NS, $WL, $POD, $CONTAINER, $NODE and $HPA are placeholders for the real " +
      "Kubernetes names, and <kube-context> is the kubectl context. Keep them as variables " +
      "in any command you suggest.";
  }

  return { text, mode, replaced: [...replaced].sort() };
};
