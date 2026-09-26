import { stateClient } from "@dynatrace-sdk/client-state";

import {
  EXCLUDED_NAMESPACES_CONTAINING,
  EXCLUDED_NAMESPACES_EXACT,
  INSTANCE_HOURLY_USD,
  OWNERSHIP_KEYS,
} from "../config/site";
import { EXTRA_FILTERS, INVALID_EXTRA_FILTERS, filterLabel } from "../config/extraFilters";
import type { Lang, Localized } from "../i18n";
import { ownership } from "../ownership";
import { excludedNamespacesClause } from "../queries/namespaces";
import type { Records } from "./runQuery";

/**
 * Chequeos de instalación: qué necesita ArchorKube del tenant para que cada
 * módulo funcione, y qué hacer cuando falta.
 *
 * Es la fuente única para dos consumidores:
 *  - la página Setup, que los ejecuta y muestra el semáforo;
 *  - los agentes que montan el repo (docs/SETUP.md, AGENTS.md), que leen
 *    este archivo y corren las mismas DQL en un notebook o por MCP.
 * Si un módulo empieza a depender de un dato nuevo, su chequeo va aquí.
 *
 * Bilingüe: cada texto va en inglés y español lado a lado (`Localized`), y
 * las evaluaciones reciben el idioma para armar sus mensajes. Los títulos en
 * inglés son los que cita docs/SETUP.md.
 *
 * Todos son de solo lectura. Ninguno escribe en el tenant.
 */

/** `info` = opcional: no bloquea nada, pero habilita algo si se configura. */
export type CheckStatus = "ok" | "warn" | "fail" | "info";

export interface CheckResult {
  status: CheckStatus;
  detail: string;
  /** Líneas extra (sugerencias, valores faltantes). */
  items?: string[];
}

export type CheckGroup = "kubernetes" | "related" | "ownership" | "installation" | "settings";

export const GROUP_LABELS: Record<CheckGroup, Localized> = {
  kubernetes: { en: "Kubernetes data", es: "Datos de Kubernetes" },
  related: { en: "Related data", es: "Datos relacionados" },
  ownership: { en: "Ownership", es: "Propiedad" },
  installation: { en: "Installation files", es: "Archivos de instalación" },
  settings: { en: "App permissions", es: "Permisos de la app" },
};

interface BaseCheck {
  id: string;
  group: CheckGroup;
  title: Localized;
  /** Módulos que dejan de funcionar (o funcionan a medias) si falla. */
  affects: Localized;
  /** Qué hacer si falla, en texto plano. */
  fix: Localized;
}

export interface QueryCheck extends BaseCheck {
  kind: "query";
  query: string;
  maxRecords?: number;
  evaluate: (records: Records, lang: Lang) => CheckResult;
}

export interface ClientCheck extends BaseCheck {
  kind: "client";
  run: (lang: Lang) => Promise<CheckResult>;
}

export type SetupCheck = QueryCheck | ClientCheck;

/** Elige el texto del idioma: `const l = pick(lang); l("…", "…")`. */
const pick =
  (lang: Lang) =>
  (en: string, es: string): string =>
    lang === "es" ? es : en;

const count = (records: Records, field = "n"): number => Number(records[0]?.[field] ?? 0);
const pct = (part: number, total: number): number =>
  total > 0 ? Math.round((100 * part) / total) : 0;

/** Chequeo de "¿hay al menos un registro?" para métricas y entidades. */
const presence = (
  found: (n: number) => Localized,
  missing: Localized,
  missingStatus: CheckStatus = "fail",
): ((records: Records, lang: Lang) => CheckResult) => {
  return (records, lang) => {
    const n = count(records);
    return n > 0
      ? { status: "ok", detail: found(n)[lang] }
      : { status: missingStatus, detail: missing[lang] };
  };
};

// ─── Descubrimiento de labels ────────────────────────────────────────────────

/**
 * Qué nombres de clave suelen significar cada campo de propiedad. Tier solo
 * acepta claves que se llamen tier: una "criticidad de negocio" es otro dato
 * aunque suene parecido, y va como filtro opcional.
 */
const FIELD_HINTS: Record<keyof typeof OWNERSHIP_KEYS, RegExp> = {
  squad: /squad|team|owner(?!-id)|equipo/i,
  tribu: /tribe|tribu|domain|dominio/i,
  tier: /tier/i,
  appCode: /part-of|app-?code|product|producto/i,
};

/**
 * Forma que deben tener los valores de una clave para proponerla como ese
 * campo. Tier es una escala corta (1, 2, 3 · t1 · tier-2); los demás campos
 * son nombres libres y no se validan por forma.
 */
const VALUE_SHAPE: Partial<Record<keyof typeof OWNERSHIP_KEYS, RegExp>> = {
  tier: /^(t|tier[-_ ]?)?\d+$/i,
};

/**
 * Valores que no son un nombre de equipo ni de dominio aunque la clave se
 * llame "owner" o "team": emails, identificadores largos, números sueltos.
 * Una clave con valores así no se propone como squad ni como tribu.
 */
const NOT_A_NAME = /@|^[0-9a-f-]{16,}$|^\d+$/i;

/**
 * Claves que suelen servir como filtro sin ser dueño ni tier: criticidad de
 * negocio, centro de costo, producto, entorno.
 */
const FILTER_HINTS =
  /critical|criticality|cost|center|centro|product|producto|business|negocio|environment|env$/i;

/**
 * Cuenta en qué porcentaje de workloads aparece cada clave de label o
 * annotation, y compara con las claves configuradas en `config/site.ts`.
 */
const evaluateLabelDiscovery = (records: Records, lang: Lang): CheckResult => {
  const l = pick(lang);
  const total = records.length;
  if (total === 0) {
    return {
      status: "warn",
      detail: l(
        "No Kubernetes workloads found in dt.entity.cloud_application.",
        "No se encontraron workloads de Kubernetes en dt.entity.cloud_application.",
      ),
    };
  }
  const coverage = new Map<string, number>();
  // Unos pocos valores por clave: cubrir más workloads no sirve si los valores
  // no están en la misma escala (un tier "high/low" contra uno "1/2/3").
  const samples = new Map<string, Set<string>>();
  for (const r of records) {
    const all = {
      ...((r.lbl as Record<string, unknown>) ?? {}),
      ...((r.ann as Record<string, unknown>) ?? {}),
    };
    for (const [k, v] of Object.entries(all)) {
      coverage.set(k, (coverage.get(k) ?? 0) + 1);
      const values = samples.get(k) ?? new Set<string>();
      if (values.size < 4 && typeof v === "string" && v) values.add(v);
      samples.set(k, values);
    }
  }
  const sample = (key: string): string => {
    const values = [...(samples.get(key) ?? [])];
    return values.length
      ? l(` (values like: ${values.join(", ")})`, ` (valores como: ${values.join(", ")})`)
      : "";
  };

  const items: string[] = [];
  let suggestions = 0;
  for (const field of Object.keys(OWNERSHIP_KEYS) as (keyof typeof OWNERSHIP_KEYS)[]) {
    const configured = OWNERSHIP_KEYS[field];
    const configuredPct = pct(coverage.get(configured) ?? 0, total);
    // Dos protecciones antes de proponer un reemplazo, porque cubrir más
    // workloads no lo hace el mismo dato:
    //  1. la forma de los valores del campo (tier = escala corta), que vale
    //     también en una instalación nueva, cuando la clave configurada aún
    //     no existe y no hay con qué comparar;
    //  2. la misma escala que la clave configurada, si esa tiene valores.
    const values = (key: string) => [...(samples.get(key) ?? [])];
    const numeric = (key: string) =>
      values(key).length > 0 && values(key).every((v) => /^\d+$/.test(v));
    const shape = VALUE_SHAPE[field];
    const namesOnly = field === "squad" || field === "tribu";
    const fits = (key: string) =>
      (!shape || (values(key).length > 0 && values(key).every((v) => shape.test(v)))) &&
      (!namesOnly || !values(key).some((v) => NOT_A_NAME.test(v))) &&
      (values(configured).length === 0 || numeric(configured) === numeric(key));
    const best = [...coverage.entries()]
      .filter(([k]) => k !== configured && FIELD_HINTS[field].test(k) && fits(k))
      .sort((a, b) => b[1] - a[1])[0];
    const bestPct = best ? pct(best[1], total) : 0;
    if (best && bestPct >= configuredPct + 10) {
      suggestions++;
      items.push(
        l(
          `${field}: configured "${configured}" is on ${configuredPct}% of workloads${sample(configured)}; "${best[0]}" is on ${bestPct}%${sample(best[0])}. If the values mean the same, set OWNERSHIP_KEYS.${field} = "${best[0]}" in ui/app/config/site.ts.`,
          `${field}: la clave configurada "${configured}" está en el ${configuredPct}% de los workloads${sample(configured)}; "${best[0]}" está en el ${bestPct}%${sample(best[0])}. Si los valores significan lo mismo, pon OWNERSHIP_KEYS.${field} = "${best[0]}" en ui/app/config/site.ts.`,
        ),
      );
    } else {
      items.push(
        l(
          `${field}: "${configured}" is on ${configuredPct}% of workloads.`,
          `${field}: "${configured}" está en el ${configuredPct}% de los workloads.`,
        ),
      );
    }
  }

  // Filtros declarados que la app descartó (id con guion, sin clave): sin este
  // aviso desaparecen sin ningún error.
  for (const filter of INVALID_EXTRA_FILTERS) {
    suggestions++;
    items.push(
      l(
        `Optional filter "${filterLabel(filter, lang)}" was ignored: its id "${filter.id}" must use only letters and numbers (no dashes), and it needs a key.`,
        `El filtro opcional "${filterLabel(filter, lang)}" se ignoró: su id "${filter.id}" debe usar solo letras y números (sin guiones), y necesita una clave.`,
      ),
    );
  }

  // Filtros opcionales ya configurados: si la clave no existe, el selector se
  // esconde, así que conviene saberlo aquí y no por su ausencia en la UI.
  for (const filter of EXTRA_FILTERS) {
    const share = pct(coverage.get(filter.key) ?? 0, total);
    const single = (samples.get(filter.key)?.size ?? 0) === 1;
    items.push(
      share === 0
        ? l(
            `Optional filter "${filterLabel(filter, lang)}": "${filter.key}" wasn't found, so the filter is hidden.`,
            `Filtro opcional "${filterLabel(filter, lang)}": no se encontró "${filter.key}", así que el filtro queda oculto.`,
          )
        : single
          ? l(
              `Optional filter "${filterLabel(filter, lang)}": "${filter.key}" is on ${share}% of workloads but has a single value${sample(filter.key)}, so filtering by it changes nothing.`,
              `Filtro opcional "${filterLabel(filter, lang)}": "${filter.key}" está en el ${share}% de los workloads pero tiene un solo valor${sample(filter.key)}, así que filtrar por él no cambia nada.`,
            )
          : l(
              `Optional filter "${filterLabel(filter, lang)}": "${filter.key}" is on ${share}% of workloads${sample(filter.key)}.`,
              `Filtro opcional "${filterLabel(filter, lang)}": "${filter.key}" está en el ${share}% de los workloads${sample(filter.key)}.`,
            ),
    );
  }

  // Claves que suelen servir como filtro y todavía no se usan en ningún lado.
  // Con un solo valor no filtran nada (un "environment" que siempre es prod).
  const used = new Set<string>([
    ...Object.values(OWNERSHIP_KEYS),
    ...EXTRA_FILTERS.map((f) => f.key),
  ]);
  const candidates = [...coverage.entries()]
    .filter(
      ([k, n]) =>
        !used.has(k) &&
        FILTER_HINTS.test(k) &&
        pct(n, total) >= 10 &&
        (samples.get(k)?.size ?? 0) >= 2,
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [key, n] of candidates) {
    items.push(
      l(
        `Could be an optional filter: "${key}" is on ${pct(n, total)}% of workloads${sample(key)}. Add it to EXTRA_FILTERS in ui/app/config/site.ts.`,
        `Podría ser un filtro opcional: "${key}" está en el ${pct(n, total)}% de los workloads${sample(key)}. Agrégalo a EXTRA_FILTERS en ui/app/config/site.ts.`,
      ),
    );
  }

  return {
    status: suggestions > 0 ? "warn" : "ok",
    detail:
      suggestions > 0
        ? l(
            `Some ownership keys or optional filters need a change (${total} workloads scanned).`,
            `Algunas claves de propiedad o filtros opcionales necesitan un cambio (${total} workloads revisados).`,
          )
        : l(
            `The configured label keys match what your workloads carry (${total} workloads scanned).`,
            `Las claves configuradas coinciden con las labels de tus workloads (${total} workloads revisados).`,
          ),
    items,
  };
};

/**
 * Nombres típicos de namespaces de plataforma: observabilidad, ingress, malla,
 * GitOps, seguridad y la propia infraestructura del cluster. Solo sirve para
 * advertir; qué se excluye lo decide cada instalación en site.ts.
 */
const PLATFORM_NAMESPACE =
  /^(kube-|dynatrace|monitoring|prometheus|grafana|logging|elastic|ingress|nginx|traefik|istio|linkerd|cert-manager|argocd|argo-|flux|gatekeeper|kyverno|keda|velero|external-dns|calico|tigera|cilium|metallb|azure-|aks-|gke-|amazon-|aws-)/i;

// ─── Chequeos ────────────────────────────────────────────────────────────────

export const CHECKS: SetupCheck[] = [
  // Kubernetes
  {
    kind: "query",
    id: "k8s-clusters",
    group: "kubernetes",
    title: {
      en: "Kubernetes clusters are monitored",
      es: "Hay clusters de Kubernetes monitoreados",
    },
    affects: { en: "All modules", es: "Todos los módulos" },
    fix: {
      en: "Install the Dynatrace Operator in each cluster and enable Kubernetes monitoring. The app also needs the storage:smartscape:read scope.",
      es: "Instala el Dynatrace Operator en cada cluster y activa el monitoreo de Kubernetes. La app además necesita el scope storage:smartscape:read.",
    },
    query: "smartscapeNodes K8S_CLUSTER | summarize n = count()",
    evaluate: presence(
      (n) => ({ en: `${n} cluster(s) found.`, es: `${n} cluster(s) encontrados.` }),
      { en: "No Kubernetes clusters found.", es: "No se encontraron clusters de Kubernetes." },
    ),
  },
  {
    kind: "query",
    id: "k8s-requests",
    group: "kubernetes",
    title: {
      en: "Container requests and limits metrics",
      es: "Métricas de requests y límites de contenedores",
    },
    affects: {
      en: "Rightsizing, Idle, Nodes, Spend",
      es: "Rightsizing, Ociosos, Nodos, Gasto",
    },
    fix: {
      en: "Kubernetes metrics aren't arriving. Check that the Dynatrace Operator collects Kubernetes metrics and that the app has storage:metrics:read.",
      es: "No están llegando las métricas de Kubernetes. Revisa que el Dynatrace Operator las recolecte y que la app tenga storage:metrics:read.",
    },
    query:
      "timeseries r = sum(dt.kubernetes.container.requests_cpu), by:{k8s.workload.name}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => ({
        en: `Metrics for ${n} workload(s) in the last 2 hours.`,
        es: `Métricas de ${n} workload(s) en las últimas 2 horas.`,
      }),
      {
        en: "No dt.kubernetes.container.requests_cpu data in the last 2 hours.",
        es: "Sin datos de dt.kubernetes.container.requests_cpu en las últimas 2 horas.",
      },
    ),
  },
  {
    kind: "query",
    id: "k8s-usage",
    group: "kubernetes",
    title: {
      en: "Container CPU and memory usage metrics",
      es: "Métricas de uso de CPU y memoria de contenedores",
    },
    affects: { en: "Rightsizing, Idle, Preventive", es: "Rightsizing, Ociosos, Preventiva" },
    fix: {
      en: "Usage metrics come from the kubelet (cAdvisor). Check the Operator's metric collection settings for your clusters.",
      es: "Las métricas de uso vienen del kubelet (cAdvisor). Revisa la configuración de recolección de métricas del Operator en tus clusters.",
    },
    query:
      "timeseries u = sum(dt.kubernetes.container.cpu_usage), by:{k8s.workload.name}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => ({
        en: `Usage for ${n} workload(s) in the last 2 hours.`,
        es: `Uso de ${n} workload(s) en las últimas 2 horas.`,
      }),
      {
        en: "No dt.kubernetes.container.cpu_usage data in the last 2 hours.",
        es: "Sin datos de dt.kubernetes.container.cpu_usage en las últimas 2 horas.",
      },
    ),
  },
  {
    kind: "query",
    id: "k8s-restarts",
    group: "kubernetes",
    title: { en: "Restart and OOM kill metrics", es: "Métricas de reinicios y OOM kills" },
    affects: { en: "Preventive, Idle", es: "Preventiva, Ociosos" },
    fix: {
      en: "Restart counts come with Kubernetes monitoring. If clusters are monitored but this is empty, check the Operator version and metric settings.",
      es: "Los reinicios vienen con el monitoreo de Kubernetes. Si los clusters están monitoreados y esto está vacío, revisa la versión del Operator y su configuración de métricas.",
    },
    query:
      "timeseries r = sum(dt.kubernetes.container.restarts), by:{k8s.workload.name}, from: now()-24h | summarize n = count()",
    evaluate: presence(
      (n) => ({
        en: `Restart data for ${n} workload(s) in the last 24 hours.`,
        es: `Datos de reinicios de ${n} workload(s) en las últimas 24 horas.`,
      }),
      {
        en: "No dt.kubernetes.container.restarts data in the last 24 hours.",
        es: "Sin datos de dt.kubernetes.container.restarts en las últimas 24 horas.",
      },
    ),
  },
  {
    kind: "query",
    id: "k8s-pod-spec",
    group: "kubernetes",
    title: {
      en: "Pod specs (Kubernetes manifests) in Smartscape",
      es: "Specs de pods (manifiestos de Kubernetes) en Smartscape",
    },
    affects: {
      en: "Compliance, Guide (Why is this flagged?)",
      es: "Cumplimiento, Guía (¿Por qué se marca?)",
    },
    fix: {
      en: "Compliance reads probes, limits and securityContext from the pod spec (k8s.object). If it's missing, check that your Kubernetes monitoring ingests object configuration.",
      es: "Cumplimiento lee las probes, los límites y el securityContext del spec del pod (k8s.object). Si falta, revisa que el monitoreo de Kubernetes ingiera la configuración de los objetos.",
    },
    query: "smartscapeNodes K8S_POD | filter isNotNull(k8s.object) | summarize n = count()",
    evaluate: presence(
      (n) => ({ en: `${n} pod spec(s) available.`, es: `${n} spec(s) de pod disponibles.` }),
      {
        en: "No pod has k8s.object: Compliance will be empty.",
        es: "Ningún pod tiene k8s.object: Cumplimiento va a quedar vacío.",
      },
    ),
  },
  {
    kind: "query",
    id: "k8s-hpa",
    group: "kubernetes",
    title: { en: "Horizontal Pod Autoscalers", es: "Horizontal Pod Autoscalers" },
    affects: { en: "Elasticity", es: "Elasticidad" },
    fix: {
      en: "Nothing to fix if you don't use HPAs. Otherwise, check that HPAs show up in Smartscape.",
      es: "No hay nada que corregir si no usas HPAs. Si los usas, revisa que aparezcan en Smartscape.",
    },
    query: "smartscapeNodes K8S_HORIZONTALPODAUTOSCALER | summarize n = count()",
    evaluate: presence(
      (n) => ({ en: `${n} HPA(s) found.`, es: `${n} HPA(s) encontrados.` }),
      {
        en: "No HPAs found: Elasticity will be empty. Fine if you don't autoscale.",
        es: "No se encontraron HPAs: Elasticidad va a quedar vacío. Está bien si no usas autoescalado.",
      },
      "info",
    ),
  },
  {
    kind: "query",
    id: "k8s-node-capacity",
    group: "kubernetes",
    title: { en: "Node capacity metrics", es: "Métricas de capacidad de nodos" },
    affects: { en: "Nodes, Spend", es: "Nodos, Gasto" },
    fix: {
      en: "Node allocatable metrics come with Kubernetes monitoring; check the Operator's metric collection.",
      es: "Las métricas de capacidad asignable de los nodos vienen con el monitoreo de Kubernetes; revisa la recolección de métricas del Operator.",
    },
    query:
      "timeseries a = sum(dt.kubernetes.node.cpu_allocatable), by:{k8s.node.name}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => ({ en: `Capacity for ${n} node(s).`, es: `Capacidad de ${n} nodo(s).` }),
      {
        en: "No dt.kubernetes.node.cpu_allocatable data in the last 2 hours.",
        es: "Sin datos de dt.kubernetes.node.cpu_allocatable en las últimas 2 horas.",
      },
    ),
  },

  // Datos cruzados
  {
    kind: "query",
    id: "host-metrics",
    group: "related",
    title: {
      en: "Host CPU and memory (OneAgent on nodes)",
      es: "CPU y memoria de hosts (OneAgent en los nodos)",
    },
    affects: {
      en: "Bottlenecks (node saturation)",
      es: "Cuellos de botella (saturación de nodos)",
    },
    fix: {
      en: "Node saturation uses dt.host.* metrics, which need OneAgent (full-stack or host monitoring) on the nodes.",
      es: "La saturación de nodos usa las métricas dt.host.*, que necesitan OneAgent (full-stack o monitoreo de host) en los nodos.",
    },
    query:
      "timeseries c = avg(dt.host.cpu.usage), by:{dt.entity.host}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => ({ en: `${n} host(s) reporting.`, es: `${n} host(s) reportando.` }),
      {
        en: "No dt.host.cpu.usage data: node saturation will be empty.",
        es: "Sin datos de dt.host.cpu.usage: la saturación de nodos va a quedar vacía.",
      },
      "warn",
    ),
  },
  {
    kind: "query",
    id: "apm-requests",
    group: "related",
    title: { en: "Service requests (APM)", es: "Requests de servicios (APM)" },
    affects: { en: "Idle (traffic rule)", es: "Ociosos (regla de tráfico)" },
    fix: {
      en: "Idle confirms a workload only when APM shows no traffic. Without services, verdicts stay as 'no APM data'. Enable code-level monitoring (OneAgent) on your workloads.",
      es: "Ociosos confirma un workload solo cuando APM no muestra tráfico. Sin servicios, los veredictos quedan como 'sin dato de APM'. Activa el monitoreo a nivel de código (OneAgent) en tus workloads.",
    },
    query:
      "timeseries r = sum(dt.service.request.count), by:{dt.entity.service}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => ({ en: `${n} service(s) with requests.`, es: `${n} servicio(s) con requests.` }),
      {
        en: "No service requests: Idle can't confirm traffic.",
        es: "Sin requests de servicios: Ociosos no puede confirmar el tráfico.",
      },
      "warn",
    ),
  },
  {
    kind: "query",
    id: "logs",
    group: "related",
    title: { en: "Container logs", es: "Logs de contenedores" },
    affects: { en: "Errors", es: "Errores" },
    fix: {
      en: "Errors reads logs with k8s.container.name. Enable log ingestion for Kubernetes (Operator log monitoring) and give the app storage:logs:read.",
      es: "Errores lee logs que traen k8s.container.name. Activa la ingesta de logs de Kubernetes (monitoreo de logs del Operator) y dale a la app storage:logs:read.",
    },
    query:
      "fetch logs, from: now()-1h | filter isNotNull(k8s.container.name) | limit 1 | summarize n = count()",
    evaluate: presence(
      () => ({ en: "Container logs are arriving.", es: "Están llegando logs de contenedores." }),
      {
        en: "No container logs in the last hour: Errors will be empty.",
        es: "Sin logs de contenedores en la última hora: Errores va a quedar vacío.",
      },
      "warn",
    ),
  },

  // Propiedad
  {
    kind: "query",
    id: "ownership-coverage",
    group: "ownership",
    title: { en: "Workloads with an owner", es: "Workloads con dueño" },
    affects: {
      en: "Filters, Orphans, Tiers, Charts by squad",
      es: "Filtros, Huérfanos, Tiers, gráficas por squad",
    },
    fix: {
      en: "Point the ownership provider at where your owners live: labels (keys in config/site.ts), namespaces, manual rules or your catalog (ownership/active.ts). The label discovery check below suggests keys.",
      es: "Apunta el proveedor de propiedad a donde viven tus dueños: labels (claves en config/site.ts), namespaces, reglas manuales o tu catálogo (ownership/active.ts). El chequeo de claves de labels, más abajo, sugiere claves.",
    },
    query: `smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET
${excludedNamespacesClause()}
${ownership.enrich("k8s.workload.name")}
| summarize total = count(),
    with_squad = countIf(isNotNull(squad)),
    with_tier = countIf(isNotNull(tier)),
    with_tribu = countIf(isNotNull(tribu)),
    with_app = countIf(isNotNull(appCode))`,
    evaluate: (records, lang) => {
      const l = pick(lang);
      const total = count(records, "total");
      if (total === 0) {
        return {
          status: "warn",
          detail: l("No workloads to evaluate.", "No hay workloads para evaluar."),
        };
      }
      const squad = pct(count(records, "with_squad"), total);
      const items = [
        `squad: ${squad}%`,
        `tier: ${pct(count(records, "with_tier"), total)}%`,
        `${l("tribe/domain", "tribu/dominio")}: ${pct(count(records, "with_tribu"), total)}%`,
        `app code: ${pct(count(records, "with_app"), total)}%`,
      ];
      const status: CheckStatus = squad >= 80 ? "ok" : squad >= 40 ? "warn" : "fail";
      return {
        status,
        detail: l(
          `${squad}% of ${total} workloads have an owner.`,
          `El ${squad}% de ${total} workloads tiene dueño.`,
        ),
        items,
      };
    },
  },
  {
    kind: "query",
    id: "label-discovery",
    group: "ownership",
    title: {
      en: "Ownership label keys and optional filters",
      es: "Claves de labels de propiedad y filtros opcionales",
    },
    affects: {
      en: "Ownership (labels provider), Optional filters",
      es: "Propiedad (proveedor de labels), filtros opcionales",
    },
    fix: {
      en: "Copy suggested ownership keys into OWNERSHIP_KEYS, and keys you want to filter by into EXTRA_FILTERS, both in ui/app/config/site.ts. Then re-run Setup.",
      es: "Copia las claves de propiedad sugeridas en OWNERSHIP_KEYS, y las claves por las que quieras filtrar en EXTRA_FILTERS, las dos en ui/app/config/site.ts. Después vuelve a correr Setup.",
    },
    query:
      "fetch dt.entity.cloud_application | fields lbl = cloudApplicationLabels, ann = kubernetesAnnotations | limit 10000",
    maxRecords: 10000,
    evaluate: evaluateLabelDiscovery,
  },
  {
    kind: "query",
    id: "cost-allocation",
    group: "ownership",
    title: {
      en: "Dynatrace cost allocation (cost centers)",
      es: "Cost allocation de Dynatrace (centros de costo)",
    },
    affects: {
      en: "Cost center showback (coming)",
      es: "Showback por centro de costo (próximamente)",
    },
    fix: {
      en: "Optional. Configure Dynatrace cost allocation so Kubernetes data carries dt.cost.costcenter and dt.cost.product.",
      es: "Opcional. Configura el cost allocation de Dynatrace para que los datos de Kubernetes traigan dt.cost.costcenter y dt.cost.product.",
    },
    query:
      "timeseries r = sum(dt.kubernetes.container.requests_cpu), by:{dt.cost.costcenter}, from: now()-2h | filter isNotNull(dt.cost.costcenter) | summarize n = count()",
    evaluate: presence(
      (n) => ({
        en: `${n} cost center(s) found on Kubernetes metrics.`,
        es: `${n} centro(s) de costo encontrados en las métricas de Kubernetes.`,
      }),
      {
        en: "Not configured. Optional: it enables showback by cost center.",
        es: "No está configurado. Es opcional: habilita el showback por centro de costo.",
      },
      "info",
    ),
  },

  // Instalación
  {
    kind: "query",
    id: "instance-prices",
    group: "installation",
    title: {
      en: "Instance prices for your node types",
      es: "Precios de instancia para tus tipos de nodo",
    },
    affects: {
      en: "Spend, USD in Rightsizing and Idle",
      es: "Gasto, USD en Rightsizing y Ociosos",
    },
    fix: {
      en: "Add each instance type and its hourly price to INSTANCE_HOURLY_USD in ui/app/config/site.ts.",
      es: "Agrega cada tipo de instancia y su precio por hora a INSTANCE_HOURLY_USD en ui/app/config/site.ts.",
    },
    query:
      "smartscapeNodes K8S_NODE | fields t = tags[`beta.kubernetes.io/instance-type`] | summarize n = count(), by:{t}",
    evaluate: (records, lang) => {
      const l = pick(lang);
      const known = new Set(Object.keys(INSTANCE_HOURLY_USD));
      const total = records.reduce((s, r) => s + Number(r.n ?? 0), 0);
      if (total === 0) {
        return {
          status: "warn",
          detail: l(
            "No nodes with an instance type label.",
            "No hay nodos con la label de tipo de instancia.",
          ),
        };
      }
      const missing = records.filter((r) => typeof r.t === "string" && !known.has(r.t));
      const priced = total - missing.reduce((s, r) => s + Number(r.n ?? 0), 0);
      const share = pct(priced, total);
      return {
        status: share === 100 ? "ok" : "warn",
        detail:
          known.size === 0
            ? l(
                "No prices configured: spend shows as unknown instead of wrong.",
                "No hay precios configurados: el gasto aparece como desconocido en vez de mal calculado.",
              )
            : l(
                `${share}% of ${total} nodes have a configured price.`,
                `El ${share}% de ${total} nodos tiene un precio configurado.`,
              ),
        items: missing
          .slice(0, 8)
          .map((r) =>
            l(
              `Missing price: ${String(r.t)} (${Number(r.n)} nodes)`,
              `Falta precio: ${String(r.t)} (${Number(r.n)} nodos)`,
            ),
          ),
      };
    },
  },
  {
    kind: "query",
    id: "excluded-namespaces",
    group: "installation",
    title: { en: "Excluded namespaces exist", es: "Los namespaces excluidos existen" },
    affects: { en: "All workload modules", es: "Todos los módulos de workloads" },
    fix: {
      en: "Fix or remove names in EXCLUDED_NAMESPACES_EXACT (ui/app/config/site.ts) that don't exist in any cluster: they're usually typos.",
      es: "Corrige o quita de EXCLUDED_NAMESPACES_EXACT (ui/app/config/site.ts) los nombres que no existen en ningún cluster: suelen ser errores de tipeo.",
    },
    query: "smartscapeNodes K8S_NAMESPACE | fields name | limit 10000",
    maxRecords: 10000,
    evaluate: (records, lang) => {
      const l = pick(lang);
      const names = new Set(records.map((r) => String(r.name)));
      const missing = EXCLUDED_NAMESPACES_EXACT.filter((ns) => !names.has(ns));
      return missing.length === 0
        ? {
            status: "ok",
            detail: l(
              `All ${EXCLUDED_NAMESPACES_EXACT.length} excluded namespace(s) exist.`,
              `Los ${EXCLUDED_NAMESPACES_EXACT.length} namespace(s) excluidos existen.`,
            ),
          }
        : {
            // Inofensivo (los defaults kube-public/kube-node-lease no existen en
            // todos los clusters), salvo que sea un nombre mal escrito.
            status: "info",
            detail: l(
              `${missing.length} excluded namespace(s) don't exist in any cluster. Harmless, unless one is a typo of a real namespace.`,
              `${missing.length} namespace(s) excluidos no existen en ningún cluster. Es inofensivo, salvo que alguno sea un error de tipeo de un namespace real.`,
            ),
            items: missing.map((ns) => l(`Not found: ${ns}`, `No encontrado: ${ns}`)),
          };
    },
  },
  {
    kind: "query",
    id: "namespace-scope",
    group: "installation",
    title: {
      en: "Namespaces that aren't teams are excluded",
      es: "Los namespaces que no son de equipos están excluidos",
    },
    affects: {
      en: "Ownership (namespace provider), All workload modules",
      es: "Propiedad (proveedor de namespace), todos los módulos de workloads",
    },
    fix: {
      en: "Add platform namespaces (monitoring, ingress, Dynatrace, service mesh…) to EXCLUDED_NAMESPACES_EXACT in ui/app/config/site.ts. If a team namespace is excluded only because it contains a substring from EXCLUDED_NAMESPACES_CONTAINING, make that rule more specific.",
      es: "Agrega los namespaces de plataforma (monitoreo, ingress, Dynatrace, service mesh…) a EXCLUDED_NAMESPACES_EXACT en ui/app/config/site.ts. Si un namespace de equipo queda excluido solo porque contiene un fragmento de EXCLUDED_NAMESPACES_CONTAINING, haz esa regla más específica.",
    },
    query: "smartscapeNodes K8S_NAMESPACE | fields name | limit 10000",
    maxRecords: 10000,
    evaluate: (records, lang) => {
      const l = pick(lang);
      const names = [...new Set(records.map((r) => String(r.name)))];
      const exact = new Set(EXCLUDED_NAMESPACES_EXACT);
      const bySubstring = (ns: string) =>
        EXCLUDED_NAMESPACES_CONTAINING.some((needle) => ns.includes(needle));
      const excluded = (ns: string) => exact.has(ns) || bySubstring(ns);

      // Con el proveedor de namespace en la cadena, un namespace de plataforma
      // que no se excluye aparece como "squad" e infla la cobertura de dueños.
      const namespaceOwners = ownership.id.split("+").includes("namespace");
      const platformLeft = names.filter((ns) => PLATFORM_NAMESPACE.test(ns) && !excluded(ns));
      // Lo contrario: un namespace de equipo que cae por una regla de substring
      // ("system" excluye también "payment-system") sin que nadie lo note.
      const teamDropped = names.filter(
        (ns) => !exact.has(ns) && bySubstring(ns) && !PLATFORM_NAMESPACE.test(ns),
      );

      const items = [
        ...platformLeft.map((ns) =>
          l(
            `Looks like a platform namespace and isn't excluded: ${ns}${namespaceOwners ? " (it would show up as a squad)" : ""}`,
            `Parece un namespace de plataforma y no está excluido: ${ns}${namespaceOwners ? " (aparecería como squad)" : ""}`,
          ),
        ),
        ...teamDropped.map((ns) =>
          l(
            `Excluded only by a substring rule, check it isn't a team namespace: ${ns}`,
            `Excluido solo por una regla de fragmento, revisa que no sea un namespace de equipo: ${ns}`,
          ),
        ),
      ];
      if (items.length === 0) {
        return {
          status: "ok",
          detail: l(
            "No platform namespace left in, no team namespace dropped.",
            "No quedan namespaces de plataforma incluidos ni namespaces de equipo excluidos.",
          ),
        };
      }
      return {
        status: namespaceOwners && platformLeft.length > 0 ? "warn" : "info",
        detail: namespaceOwners
          ? l(
              "The namespace provider is in the ownership chain, so every namespace left in counts as a team.",
              "El proveedor de namespace está en la cadena de propiedad, así que cada namespace que no se excluye cuenta como un equipo.",
            )
          : l(
              "Review which namespaces count as workloads of a team.",
              "Revisa qué namespaces cuentan como workloads de un equipo.",
            ),
        items: items.slice(0, 15),
      };
    },
  },

  // Permisos de la app
  {
    kind: "client",
    id: "user-settings",
    group: "settings",
    title: {
      en: "Per-user settings can be saved",
      es: "Se pueden guardar las preferencias por usuario",
    },
    affects: {
      en: "Settings (language and AI data mode)",
      es: "Configuración (idioma y modo de datos de IA)",
    },
    fix: {
      en: "Consent the state:user-app-states:read and :write scopes when (re)deploying the app. Without them, the app stays in English and the AI data mode stays on placeholders.",
      es: "Acepta los scopes state:user-app-states:read y :write al (re)desplegar la app. Sin ellos, la app queda en inglés y el modo de datos de IA queda en placeholders.",
    },
    run: async (lang) => {
      const l = pick(lang);
      try {
        await stateClient.getUserAppState({ key: "archorkube-ai-settings-v1" });
        return {
          status: "ok",
          detail: l(
            "Your settings are saved in this tenant.",
            "Tus preferencias están guardadas en este tenant.",
          ),
        };
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          return {
            status: "ok",
            detail: l(
              "Allowed. You haven't saved settings yet.",
              "Permitido. Todavía no guardaste preferencias.",
            ),
          };
        }
        return {
          status: "fail",
          detail: l(
            `Can't read user settings${status ? ` (HTTP ${status})` : ""}.`,
            `No se pueden leer las preferencias del usuario${status ? ` (HTTP ${status})` : ""}.`,
          ),
        };
      }
    },
  },
];
