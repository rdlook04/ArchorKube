import { stateClient } from "@dynatrace-sdk/client-state";

import { EXCLUDED_NAMESPACES_EXACT, INSTANCE_HOURLY_USD, OWNERSHIP_KEYS } from "../config/site";
import { EXTRA_FILTERS } from "../config/extraFilters";
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

export const GROUP_LABELS: Record<CheckGroup, string> = {
  kubernetes: "Kubernetes data",
  related: "Related data",
  ownership: "Ownership",
  installation: "Installation files",
  settings: "App permissions",
};

interface BaseCheck {
  id: string;
  group: CheckGroup;
  title: string;
  /** Módulos que dejan de funcionar (o funcionan a medias) si falla. */
  affects: string[];
  /** Qué hacer si falla, en texto plano. */
  fix: string;
}

export interface QueryCheck extends BaseCheck {
  kind: "query";
  query: string;
  maxRecords?: number;
  evaluate: (records: Records) => CheckResult;
}

export interface ClientCheck extends BaseCheck {
  kind: "client";
  run: () => Promise<CheckResult>;
}

export type SetupCheck = QueryCheck | ClientCheck;

const count = (records: Records, field = "n"): number => Number(records[0]?.[field] ?? 0);
const pct = (part: number, total: number): number =>
  total > 0 ? Math.round((100 * part) / total) : 0;

/** Chequeo de "¿hay al menos un registro?" para métricas y entidades. */
const presence = (
  found: (n: number) => string,
  missing: string,
  missingStatus: CheckStatus = "fail",
): ((records: Records) => CheckResult) => {
  return (records) => {
    const n = count(records);
    return n > 0 ? { status: "ok", detail: found(n) } : { status: missingStatus, detail: missing };
  };
};

// ─── Descubrimiento de labels ────────────────────────────────────────────────

/** Qué nombres de clave suelen significar cada campo de propiedad. */
const FIELD_HINTS: Record<keyof typeof OWNERSHIP_KEYS, RegExp> = {
  squad: /squad|team|owner(?!-id)|equipo/i,
  tribu: /tribe|tribu|domain|dominio/i,
  tier: /tier|criticality|criticidad/i,
  appCode: /part-of|app-?code|product|producto/i,
};

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
const evaluateLabelDiscovery = (records: Records): CheckResult => {
  const total = records.length;
  if (total === 0) {
    return {
      status: "warn",
      detail: "No Kubernetes workloads found in dt.entity.cloud_application.",
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
    return values.length ? ` (values like: ${values.join(", ")})` : "";
  };

  const items: string[] = [];
  let suggestions = 0;
  for (const field of Object.keys(OWNERSHIP_KEYS) as (keyof typeof OWNERSHIP_KEYS)[]) {
    const configured = OWNERSHIP_KEYS[field];
    const configuredPct = pct(coverage.get(configured) ?? 0, total);
    const best = [...coverage.entries()]
      .filter(([k]) => k !== configured && FIELD_HINTS[field].test(k))
      .sort((a, b) => b[1] - a[1])[0];
    const bestPct = best ? pct(best[1], total) : 0;
    // Si la clave configurada tiene valores y la candidata usa otra escala
    // (números contra texto), no es el mismo dato aunque cubra más workloads.
    const numeric = (key: string) => {
      const values = [...(samples.get(key) ?? [])];
      return values.length > 0 && values.every((v) => /^\d+$/.test(v));
    };
    const sameScale =
      !best ||
      (samples.get(configured)?.size ?? 0) === 0 ||
      numeric(configured) === numeric(best[0]);
    if (best && bestPct >= configuredPct + 10 && !sameScale) {
      // Otro dato, no un reemplazo: se ofrece como filtro opcional más abajo.
      items.push(`${field}: "${configured}" is on ${configuredPct}% of workloads.`);
    } else if (best && bestPct >= configuredPct + 10) {
      suggestions++;
      items.push(
        `${field}: configured "${configured}" is on ${configuredPct}% of workloads${sample(configured)}; "${best[0]}" is on ${bestPct}%${sample(best[0])}. If the values mean the same, set OWNERSHIP_KEYS.${field} = "${best[0]}" in ui/app/config/site.ts.`,
      );
    } else {
      items.push(`${field}: "${configured}" is on ${configuredPct}% of workloads.`);
    }
  }

  // Filtros opcionales ya configurados: si la clave no existe, el selector se
  // esconde, así que conviene saberlo aquí y no por su ausencia en la UI.
  for (const filter of EXTRA_FILTERS) {
    const share = pct(coverage.get(filter.key) ?? 0, total);
    items.push(
      share > 0
        ? `Optional filter "${filter.label}": "${filter.key}" is on ${share}% of workloads${sample(filter.key)}.`
        : `Optional filter "${filter.label}": "${filter.key}" wasn't found, so the filter is hidden.`,
    );
  }

  // Claves que suelen servir como filtro y todavía no se usan en ningún lado.
  const used = new Set<string>([
    ...Object.values(OWNERSHIP_KEYS),
    ...EXTRA_FILTERS.map((f) => f.key),
  ]);
  const candidates = [...coverage.entries()]
    .filter(([k, n]) => !used.has(k) && FILTER_HINTS.test(k) && pct(n, total) >= 10)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [key, n] of candidates) {
    items.push(
      `Could be an optional filter: "${key}" is on ${pct(n, total)}% of workloads${sample(key)}. Add it to EXTRA_FILTERS in ui/app/config/site.ts.`,
    );
  }

  return {
    status: suggestions > 0 ? "warn" : "ok",
    detail:
      suggestions > 0
        ? `Your workloads carry ownership under different label keys than the ones configured (${total} workloads scanned).`
        : `The configured label keys match what your workloads carry (${total} workloads scanned).`,
    items,
  };
};

// ─── Chequeos ────────────────────────────────────────────────────────────────

export const CHECKS: SetupCheck[] = [
  // Kubernetes
  {
    kind: "query",
    id: "k8s-clusters",
    group: "kubernetes",
    title: "Kubernetes clusters are monitored",
    affects: ["All modules"],
    fix: "Install the Dynatrace Operator in each cluster and enable Kubernetes monitoring. The app also needs the storage:smartscape:read scope.",
    query: "smartscapeNodes K8S_CLUSTER | summarize n = count()",
    evaluate: presence((n) => `${n} cluster(s) found.`, "No Kubernetes clusters found."),
  },
  {
    kind: "query",
    id: "k8s-requests",
    group: "kubernetes",
    title: "Container requests and limits metrics",
    affects: ["Rightsizing", "Idle", "Nodes", "Spend"],
    fix: "Kubernetes metrics aren't arriving. Check that the Dynatrace Operator collects Kubernetes metrics and that the app has storage:metrics:read.",
    query:
      "timeseries r = sum(dt.kubernetes.container.requests_cpu), by:{k8s.workload.name}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => `Metrics for ${n} workload(s) in the last 2 hours.`,
      "No dt.kubernetes.container.requests_cpu data in the last 2 hours.",
    ),
  },
  {
    kind: "query",
    id: "k8s-usage",
    group: "kubernetes",
    title: "Container CPU and memory usage metrics",
    affects: ["Rightsizing", "Idle", "Preventive"],
    fix: "Usage metrics come from the kubelet (cAdvisor). Check the Operator's metric collection settings for your clusters.",
    query:
      "timeseries u = sum(dt.kubernetes.container.cpu_usage), by:{k8s.workload.name}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => `Usage for ${n} workload(s) in the last 2 hours.`,
      "No dt.kubernetes.container.cpu_usage data in the last 2 hours.",
    ),
  },
  {
    kind: "query",
    id: "k8s-restarts",
    group: "kubernetes",
    title: "Restart and OOM kill metrics",
    affects: ["Preventive", "Idle"],
    fix: "Restart counts come with Kubernetes monitoring. If clusters are monitored but this is empty, check the Operator version and metric settings.",
    query:
      "timeseries r = sum(dt.kubernetes.container.restarts), by:{k8s.workload.name}, from: now()-24h | summarize n = count()",
    evaluate: presence(
      (n) => `Restart data for ${n} workload(s) in the last 24 hours.`,
      "No dt.kubernetes.container.restarts data in the last 24 hours.",
    ),
  },
  {
    kind: "query",
    id: "k8s-pod-spec",
    group: "kubernetes",
    title: "Pod specs (Kubernetes manifests) in Smartscape",
    affects: ["Compliance", "Guide (Why is this flagged?)"],
    fix: "Compliance reads probes, limits and securityContext from the pod spec (k8s.object). If it's missing, check that your Kubernetes monitoring ingests object configuration.",
    query: "smartscapeNodes K8S_POD | filter isNotNull(k8s.object) | summarize n = count()",
    evaluate: presence(
      (n) => `${n} pod spec(s) available.`,
      "No pod has k8s.object: Compliance will be empty.",
    ),
  },
  {
    kind: "query",
    id: "k8s-hpa",
    group: "kubernetes",
    title: "Horizontal Pod Autoscalers",
    affects: ["Elasticity"],
    fix: "Nothing to fix if you don't use HPAs. Otherwise, check that HPAs show up in Smartscape.",
    query: "smartscapeNodes K8S_HORIZONTALPODAUTOSCALER | summarize n = count()",
    evaluate: presence(
      (n) => `${n} HPA(s) found.`,
      "No HPAs found: Elasticity will be empty. Fine if you don't autoscale.",
      "info",
    ),
  },
  {
    kind: "query",
    id: "k8s-node-capacity",
    group: "kubernetes",
    title: "Node capacity metrics",
    affects: ["Nodes", "Spend"],
    fix: "Node allocatable metrics come with Kubernetes monitoring; check the Operator's metric collection.",
    query:
      "timeseries a = sum(dt.kubernetes.node.cpu_allocatable), by:{k8s.node.name}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => `Capacity for ${n} node(s).`,
      "No dt.kubernetes.node.cpu_allocatable data in the last 2 hours.",
    ),
  },

  // Datos cruzados
  {
    kind: "query",
    id: "host-metrics",
    group: "related",
    title: "Host CPU and memory (OneAgent on nodes)",
    affects: ["Bottlenecks (node saturation)"],
    fix: "Node saturation uses dt.host.* metrics, which need OneAgent (full-stack or host monitoring) on the nodes.",
    query:
      "timeseries c = avg(dt.host.cpu.usage), by:{dt.entity.host}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => `${n} host(s) reporting.`,
      "No dt.host.cpu.usage data: node saturation will be empty.",
      "warn",
    ),
  },
  {
    kind: "query",
    id: "apm-requests",
    group: "related",
    title: "Service requests (APM)",
    affects: ["Idle (traffic rule)"],
    fix: "Idle confirms a workload only when APM shows no traffic. Without services, verdicts stay as 'no APM data'. Enable code-level monitoring (OneAgent) on your workloads.",
    query:
      "timeseries r = sum(dt.service.request.count), by:{dt.entity.service}, from: now()-2h | summarize n = count()",
    evaluate: presence(
      (n) => `${n} service(s) with requests.`,
      "No service requests: Idle can't confirm traffic.",
      "warn",
    ),
  },
  {
    kind: "query",
    id: "logs",
    group: "related",
    title: "Container logs",
    affects: ["Errors"],
    fix: "Errors reads logs with k8s.container.name. Enable log ingestion for Kubernetes (Operator log monitoring) and give the app storage:logs:read.",
    query:
      "fetch logs, from: now()-1h | filter isNotNull(k8s.container.name) | limit 1 | summarize n = count()",
    evaluate: presence(
      () => "Container logs are arriving.",
      "No container logs in the last hour: Errors will be empty.",
      "warn",
    ),
  },

  // Propiedad
  {
    kind: "query",
    id: "ownership-coverage",
    group: "ownership",
    title: "Workloads with an owner",
    affects: ["Filters", "Orphans", "Tiers", "Charts by squad"],
    fix: "Point the ownership provider at where your owners live: labels (keys in config/site.ts), namespaces, manual rules or your catalog (ownership/active.ts). The label discovery check below suggests keys.",
    query: `smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET
${excludedNamespacesClause()}
${ownership.enrich("k8s.workload.name")}
| summarize total = count(),
    with_squad = countIf(isNotNull(squad)),
    with_tier = countIf(isNotNull(tier)),
    with_tribu = countIf(isNotNull(tribu)),
    with_app = countIf(isNotNull(appCode))`,
    evaluate: (records) => {
      const total = count(records, "total");
      if (total === 0) return { status: "warn", detail: "No workloads to evaluate." };
      const squad = pct(count(records, "with_squad"), total);
      const items = [
        `squad: ${squad}%`,
        `tier: ${pct(count(records, "with_tier"), total)}%`,
        `tribe/domain: ${pct(count(records, "with_tribu"), total)}%`,
        `app code: ${pct(count(records, "with_app"), total)}%`,
      ];
      const status: CheckStatus = squad >= 80 ? "ok" : squad >= 40 ? "warn" : "fail";
      return { status, detail: `${squad}% of ${total} workloads have an owner.`, items };
    },
  },
  {
    kind: "query",
    id: "label-discovery",
    group: "ownership",
    title: "Ownership label keys and optional filters",
    affects: ["Ownership (labels provider)", "Optional filters"],
    fix: "Copy suggested ownership keys into OWNERSHIP_KEYS, and keys you want to filter by into EXTRA_FILTERS, both in ui/app/config/site.ts. Then re-run Setup.",
    query:
      "fetch dt.entity.cloud_application | fields lbl = cloudApplicationLabels, ann = kubernetesAnnotations | limit 10000",
    maxRecords: 10000,
    evaluate: evaluateLabelDiscovery,
  },
  {
    kind: "query",
    id: "cost-allocation",
    group: "ownership",
    title: "Dynatrace cost allocation (cost centers)",
    affects: ["Cost center showback (coming)"],
    fix: "Optional. Configure Dynatrace cost allocation so Kubernetes data carries dt.cost.costcenter and dt.cost.product.",
    query:
      "timeseries r = sum(dt.kubernetes.container.requests_cpu), by:{dt.cost.costcenter}, from: now()-2h | filter isNotNull(dt.cost.costcenter) | summarize n = count()",
    evaluate: presence(
      (n) => `${n} cost center(s) found on Kubernetes metrics.`,
      "Not configured. Optional: it enables showback by cost center.",
      "info",
    ),
  },

  // Instalación
  {
    kind: "query",
    id: "instance-prices",
    group: "installation",
    title: "Instance prices for your node types",
    affects: ["Spend", "USD in Rightsizing and Idle"],
    fix: "Add each instance type and its hourly price to INSTANCE_HOURLY_USD in ui/app/config/site.ts.",
    query:
      "smartscapeNodes K8S_NODE | fields t = tags[`beta.kubernetes.io/instance-type`] | summarize n = count(), by:{t}",
    evaluate: (records) => {
      const known = new Set(Object.keys(INSTANCE_HOURLY_USD));
      const total = records.reduce((s, r) => s + Number(r.n ?? 0), 0);
      if (total === 0) return { status: "warn", detail: "No nodes with an instance type label." };
      const missing = records.filter((r) => typeof r.t === "string" && !known.has(r.t));
      const priced = total - missing.reduce((s, r) => s + Number(r.n ?? 0), 0);
      const share = pct(priced, total);
      return {
        status: share === 100 ? "ok" : "warn",
        detail:
          known.size === 0
            ? "No prices configured: spend shows as unknown instead of wrong."
            : `${share}% of ${total} nodes have a configured price.`,
        items: missing
          .slice(0, 8)
          .map((r) => `Missing price: ${String(r.t)} (${Number(r.n)} nodes)`),
      };
    },
  },
  {
    kind: "query",
    id: "excluded-namespaces",
    group: "installation",
    title: "Excluded namespaces exist",
    affects: ["All workload modules"],
    fix: "Fix or remove names in EXCLUDED_NAMESPACES_EXACT (ui/app/config/site.ts) that don't exist in any cluster: they're usually typos.",
    query: "smartscapeNodes K8S_NAMESPACE | fields name | limit 10000",
    maxRecords: 10000,
    evaluate: (records) => {
      const names = new Set(records.map((r) => String(r.name)));
      const missing = EXCLUDED_NAMESPACES_EXACT.filter((ns) => !names.has(ns));
      return missing.length === 0
        ? {
            status: "ok",
            detail: `All ${EXCLUDED_NAMESPACES_EXACT.length} excluded namespace(s) exist.`,
          }
        : {
            status: "warn",
            detail: `${missing.length} excluded namespace(s) don't exist in any cluster.`,
            items: missing.map((ns) => `Not found: ${ns}`),
          };
    },
  },

  // Permisos de la app
  {
    kind: "client",
    id: "user-settings",
    group: "settings",
    title: "Per-user settings can be saved",
    affects: ["Settings (AI data mode)"],
    fix: "Consent the state:user-app-states:read and :write scopes when (re)deploying the app. Without them, the AI data mode stays on placeholders.",
    run: async () => {
      try {
        await stateClient.getUserAppState({ key: "archorkube-ai-settings-v1" });
        return { status: "ok", detail: "Your settings are saved in this tenant." };
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          return { status: "ok", detail: "Allowed. You haven't saved settings yet." };
        }
        return {
          status: "fail",
          detail: `Can't read user settings${status ? ` (HTTP ${status})` : ""}.`,
        };
      }
    },
  },
];
