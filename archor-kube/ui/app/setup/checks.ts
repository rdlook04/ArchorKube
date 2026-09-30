import { stateClient } from "@dynatrace-sdk/client-state";

import {
  EXCLUDED_NAMESPACES_CONTAINING,
  EXCLUDED_NAMESPACES_EXACT,
  OWNERSHIP_KEYS,
} from "../config/site";
import {
  HOURLY_USD,
  LIST_BASE,
  OWN_PRICES,
  PRICE_BASE,
  PRICE_TABLE,
  listBaseOf,
  pricingSource,
} from "../config/pricing";
import {
  EXTRA_FILTERS,
  INVALID_EXTRA_FILTERS,
  filterLabel,
  isNamespaceScoped,
} from "../config/extraFilters";
import type { Lang, Localized } from "../i18n";
import { ownership, providerText } from "../ownership";
import { excludedNamespacesClause } from "../queries/namespaces";
import {
  WORKLOAD_ANNOTATIONS,
  WORKLOAD_LABELS,
  WORKLOAD_NODES,
} from "../queries/workloads";
import type { Records } from "./runQuery";
import { LOOKUP_PATHS, hasLookup, type LookupId } from "../templates/lookups";

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
  /** Coberturas que se dibujan como barras con color, en vez de texto. */
  metrics?: CheckMetric[];
}

/**
 * Una cobertura en porcentaje. El color lo da el valor (verde, ámbar, rojo),
 * salvo en las opcionales, que no alarman aunque estén vacías. `hint` dice
 * qué significa o qué hacer, sobre todo cuando está en 0.
 */
export interface CheckMetric {
  label: string;
  pct: number;
  optional?: boolean;
  hint?: string;
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
  /** Caminos para arreglarlo, con un ejemplo cada uno, cuando hay más de uno. */
  guide?: FixOption[];
  /** Plantilla que se completa y se sube para resolverlo sin tocar código. */
  template?: LookupId;
}

/** Una forma de arreglar un chequeo: cuándo aplica, qué hacer y un ejemplo. */
export interface FixOption {
  title: Localized;
  body: Localized;
  code?: { language: "typescript" | "yaml" | "bash" | "dql"; text: string };
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

// ─── Guía de propiedad ───────────────────────────────────────────────────────

/**
 * Los caminos para que los workloads tengan dueño y tier. El que instala no
 * elige dueños ni tiers: esa es una decisión de la organización. Lo que sí
 * puede es apuntar la app a donde ya están, o explicar cómo declararlos.
 * Los ejemplos usan las claves configuradas, no unas fijas.
 */
const OWNERSHIP_GUIDE: FixOption[] = [
  {
    title: {
      en: "1. Fill the ownership table (the fastest, no code)",
      es: "1. Completar la tabla de dueños (lo más rápido, sin código)",
    },
    body: {
      en: 'Open "Template to fill: Ownership table" in this check. Download it with your workloads already listed, put the tier (and the owner where it is missing) in Excel, and upload it. It works with no change to code or manifests, and wins over labels and namespaces.',
      es: 'Abre "Plantilla para completar: Tabla de dueños" en este chequeo. Descárgala con tus workloads ya listados, pon el tier (y el dueño donde falte) en Excel y súbela. Funciona sin cambiar código ni manifiestos, y gana sobre labels y namespaces.',
    },
  },
  {
    title: {
      en: "2. Your workloads already carry owner labels",
      es: "2. Tus workloads ya llevan labels de dueño",
    },
    body: {
      en: "Point OWNERSHIP_KEYS in ui/app/config/site.ts at the keys you already use. The keys that come with the example (archorkube.io/*) are only a suggested convention. The \"Ownership label keys\" check lists the keys it finds, with sample values. A tier must look like a short scale (1, 2, 3).",
      es: "Apunta OWNERSHIP_KEYS en ui/app/config/site.ts a las claves que ya usas. Las que trae el ejemplo (archorkube.io/*) son solo una convención sugerida. El chequeo \"Claves de labels de propiedad\" lista las claves que encuentra, con valores de muestra. Un tier tiene que parecer una escala corta (1, 2, 3).",
    },
    code: {
      language: "typescript",
      text: `export const OWNERSHIP_KEYS = {
  tier: "tier",            // your key for the tier (1, 2, 3)
  squad: "team",           // the owning team
  tribu: "domain",         // tribe or business domain
  appCode: "app.kubernetes.io/part-of",
} as const;`,
    },
  },
  {
    title: {
      en: "3. Each team has its own namespaces",
      es: "3. Cada equipo tiene sus propios namespaces",
    },
    body: {
      en: "Keep namespaceProvider as the last link of the chain in ui/app/ownership/active.ts: the namespace becomes the team. First exclude platform namespaces (monitoring, ingress, the operator) in EXCLUDED_NAMESPACES_EXACT, or they count as teams. A namespace gives the owner only: it can't tell the tier.",
      es: "Deja namespaceProvider como último eslabón de la cadena en ui/app/ownership/active.ts: el namespace pasa a ser el equipo. Antes excluye los namespaces de plataforma (monitoreo, ingress, el operador) en EXCLUDED_NAMESPACES_EXACT, o cuentan como equipos. Un namespace da solo el dueño: no sabe el tier.",
    },
    code: {
      language: "typescript",
      text: `export const ownership = chainProviders(
  manualProvider(),
  labelsProvider,
  namespaceProvider, // last: the namespace as the team
);`,
    },
  },
  {
    title: {
      en: "4. Label the workloads (a decision for your organization)",
      es: "4. Etiquetar los workloads (una decisión de tu organización)",
    },
    body: {
      en: `When the data doesn't exist anywhere, someone who knows the services has to decide it: who owns each one and how critical it is (tier 1 = most critical). ArchorKube doesn't invent it. The labels go on the Deployment or StatefulSet itself, not only on the pod template. If Helm, Argo CD or Flux manages the manifest, put them in the chart or manifest: a label added by hand can be removed on the next sync. Annotations override labels, useful to fix one workload without touching its selectors. Dynatrace picks up the change within minutes.`,
      es: `Cuando el dato no existe en ningún lado, lo tiene que decidir alguien que conozca los servicios: quién es dueño de cada uno y qué tan crítico es (tier 1 = el más crítico). ArchorKube no lo inventa. Las labels van en el propio Deployment o StatefulSet, no solo en el template del pod. Si Helm, Argo CD o Flux manejan el manifiesto, ponlas en el chart o el manifiesto: una label puesta a mano se puede perder en la próxima sincronización. Las annotations ganan sobre las labels, útil para corregir un workload sin tocar sus selectores. Dynatrace toma el cambio en minutos.`,
    },
    code: {
      language: "yaml",
      text: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
  labels:
    ${OWNERSHIP_KEYS.squad}: squad-payments
    ${OWNERSHIP_KEYS.tier}: "1"
    ${OWNERSHIP_KEYS.tribu}: commerce
    ${OWNERSHIP_KEYS.appCode}: payments

# Or on a running workload, to try it out:
# kubectl label deployment checkout-api -n payments \\
#   ${OWNERSHIP_KEYS.squad}=squad-payments ${OWNERSHIP_KEYS.tier}=1`,
    },
  },
  {
    title: {
      en: "5. Owners live in a catalog, or a few resolve wrong",
      es: "5. Los dueños están en un catálogo, o unos pocos salen mal",
    },
    body: {
      en: "For a handful of workloads, or to give a tier where no label has one, add manual rules first in the chain (by exact name or by prefix). For a catalog (Backstage, a CMDB, a lookup table in Grail), write a provider in ui/app/ownership/port.ts. See docs/OWNERSHIP.md.",
      es: "Para unos pocos workloads, o para dar un tier donde ninguna label lo tiene, agrega reglas manuales primero en la cadena (por nombre exacto o por prefijo). Para un catálogo (Backstage, un CMDB, una tabla lookup en Grail), escribe un proveedor en ui/app/ownership/port.ts. Ver docs/OWNERSHIP.md.",
    },
    code: {
      language: "typescript",
      text: `export const ownership = chainProviders(
  manualProvider([
    { match: "checkout-", prefix: true, squad: "squad-payments", tier: "1" },
    { match: "batch-reconcile", squad: "squad-finops", tier: "3" },
  ]),
  labelsProvider,
  namespaceProvider,
);`,
    },
  },
];

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
 * Cuántas filas llevan cada clave de label o annotation (`lbl` y `ann` en la
 * fila), con unos pocos valores de muestra por clave: cubrir más filas no
 * sirve si los valores no están en la misma escala (un tier "high/low" contra
 * uno "1/2/3").
 */
const countKeys = (records: Records, lang: Lang) => {
  const l = pick(lang);
  const coverage = new Map<string, number>();
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
  return { coverage, samples, sample };
};

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
        "No Kubernetes workloads found in Smartscape.",
        "No se encontraron workloads de Kubernetes en Smartscape.",
      ),
    };
  }
  const { coverage, samples, sample } = countKeys(records, lang);

  const items: string[] = [];
  // Barras neutras: que una clave no se use no es un problema si los dueños
  // salen de otra fuente. El veredicto es de "Workloads with an owner".
  const metrics: CheckMetric[] = [];
  const fieldName: Record<keyof typeof OWNERSHIP_KEYS, string> = {
    tier: "Tier",
    squad: l("Owner (squad)", "Dueño (squad)"),
    tribu: l("Tribe / domain", "Tribu / dominio"),
    appCode: l("App code", "Código de aplicación"),
  };
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
    const better = best && bestPct >= configuredPct + 10;
    if (better) suggestions++;
    metrics.push({
      label: `${fieldName[field]} · ${configured}`,
      pct: configuredPct,
      optional: true,
      hint: better
        ? l(
            `"${best[0]}" is on ${bestPct}%${sample(best[0])}. If the values mean the same, set OWNERSHIP_KEYS.${field} = "${best[0]}" in ui/app/config/site.ts.`,
            `"${best[0]}" está en el ${bestPct}%${sample(best[0])}. Si los valores significan lo mismo, pon OWNERSHIP_KEYS.${field} = "${best[0]}" en ui/app/config/site.ts.`,
          )
        : configuredPct > 0
          ? sample(configured).trim() || undefined
          : l("No workload carries this key.", "Ningún workload lleva esta clave."),
    });
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
  // Los de namespace se revisan en su propio chequeo (namespace-labels).
  for (const filter of EXTRA_FILTERS.filter((f) => !isNamespaceScoped(f))) {
    const share = pct(coverage.get(filter.key) ?? 0, total);
    const single = (samples.get(filter.key)?.size ?? 0) === 1;
    metrics.push({
      label: `${l("Filter", "Filtro")}: ${filterLabel(filter, lang)} · ${filter.key}`,
      pct: share,
      optional: true,
      hint:
        share === 0
          ? l("Not found, so the filter is hidden.", "No se encontró, así que el filtro queda oculto.")
          : single
            ? l(
                `A single value${sample(filter.key)}: filtering by it changes nothing.`,
                `Un solo valor${sample(filter.key)}: filtrar por él no cambia nada.`,
              )
            : sample(filter.key).trim() || undefined,
    });
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

  items.push(
    l(
      `Owner sources in use (ui/app/ownership/active.ts): ${providerText(ownership.label, "en")}.`,
      `Fuentes de dueño en uso (ui/app/ownership/active.ts): ${providerText(ownership.label, "es")}.`,
    ),
  );

  if (suggestions > 0) {
    return {
      status: "warn",
      detail: l(
        `Some ownership keys or optional filters need a change (${total} workloads scanned).`,
        `Algunas claves de propiedad o filtros opcionales necesitan un cambio (${total} workloads revisados).`,
      ),
      items,
      metrics,
    };
  }
  // Nadie lleva las claves de dueño configuradas: casi siempre son las del
  // ejemplo, copiadas del .example. No es un error si los dueños salen de otra
  // fuente de la cadena, pero decir "coinciden" sería falso.
  const keyed = (["tier", "squad", "tribu"] as const).some(
    (field) => (coverage.get(OWNERSHIP_KEYS[field]) ?? 0) > 0,
  );
  if (!keyed) {
    return {
      status: "info",
      detail: l(
        `None of the ${total} workloads carries the configured owner keys (${OWNERSHIP_KEYS.squad}, ${OWNERSHIP_KEYS.tier}, ${OWNERSHIP_KEYS.tribu}), so labels give no owner or tier. That's fine if owners come from another source: "Workloads with an owner" shows the real coverage.`,
        `Ninguno de los ${total} workloads lleva las claves de dueño configuradas (${OWNERSHIP_KEYS.squad}, ${OWNERSHIP_KEYS.tier}, ${OWNERSHIP_KEYS.tribu}), así que las labels no dan dueño ni tier. Está bien si los dueños salen de otra fuente: "Workloads con dueño" muestra la cobertura real.`,
      ),
      items,
      metrics,
    };
  }
  return {
    status: "ok",
    detail: l(
      `The configured label keys match what your workloads carry (${total} workloads scanned).`,
      `Las claves configuradas coinciden con las labels de tus workloads (${total} workloads revisados).`,
    ),
    items,
    metrics,
  };
};

/**
 * La tabla de dueños subida a Grail: cuántas filas cruzan con un workload real
 * y cuáles tienen un tier que no parece tier. Un nombre mal escrito no rompe
 * nada, simplemente no cruza, así que conviene verlo aquí.
 */
const evaluateOwnershipTable = (records: Records, lang: Lang): CheckResult => {
  const l = pick(lang);
  const rows = records.length;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const unknown = records.filter((r) => r.known !== true).map((r) => str(r.workload));
  const badTier = records.filter((r) => str(r.tier) !== "" && !VALUE_SHAPE.tier!.test(str(r.tier)));
  const noTier = records.filter((r) => str(r.tier) === "").length;
  const items: string[] = [
    l(
      `${rows - unknown.length} of ${rows} rows match a workload in your clusters; ${noTier} rows have no tier.`,
      `${rows - unknown.length} de ${rows} filas cruzan con un workload de tus clusters; ${noTier} filas no tienen tier.`,
    ),
  ];
  if (unknown.length > 0) {
    items.push(
      l(
        `Not found in the cluster (check the name): ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`,
        `No están en el cluster (revisa el nombre): ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`,
      ),
    );
  }
  for (const r of badTier.slice(0, 5)) {
    items.push(
      l(
        `${str(r.workload)}: tier "${str(r.tier)}" isn't a short scale (1, 2, 3).`,
        `${str(r.workload)}: el tier "${str(r.tier)}" no es una escala corta (1, 2, 3).`,
      ),
    );
  }
  return {
    status: rows === 0 || unknown.length > 0 || badTier.length > 0 ? "warn" : "ok",
    detail:
      rows === 0
        ? l("The table exists but has no rows.", "La tabla existe pero no tiene filas.")
        : l(
            `The table is in use (${rows} rows).`,
            `La tabla está en uso (${rows} filas).`,
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

/**
 * Labels que pone Kubernetes, la nube o un operador en todos los namespaces:
 * no las declara nadie de la organización y no sirven como filtro.
 */
const SYSTEM_NAMESPACE_KEY =
  /kubernetes\.io\/|kubernetes\.azure\.com|dynatrace\.com|gatekeeper|^control-plane$|^name$/i;

/**
 * Labels de los namespaces: los filtros opcionales con `scope: "namespace"`
 * y claves que podrían serlo (centro de costo, entorno, dueño). Es opcional:
 * muchos clústeres no etiquetan sus namespaces y la app funciona igual.
 */
const evaluateNamespaceLabels = (records: Records, lang: Lang): CheckResult => {
  const l = pick(lang);
  const total = records.length;
  const { coverage, samples, sample } = countKeys(records, lang);
  const items: string[] = [];
  let missing = 0;
  const configured = EXTRA_FILTERS.filter(isNamespaceScoped);
  for (const filter of configured) {
    const n = coverage.get(filter.key) ?? 0;
    if (n === 0) missing++;
    items.push(
      n === 0
        ? l(
            `Optional filter "${filterLabel(filter, lang)}": no namespace has "${filter.key}", so the filter is hidden.`,
            `Filtro opcional "${filterLabel(filter, lang)}": ningún namespace tiene "${filter.key}", así que el filtro queda oculto.`,
          )
        : l(
            `Optional filter "${filterLabel(filter, lang)}": "${filter.key}" is on ${n} of ${total} namespaces${sample(filter.key)}.`,
            `Filtro opcional "${filterLabel(filter, lang)}": "${filter.key}" está en ${n} de ${total} namespaces${sample(filter.key)}.`,
          ),
    );
  }
  const used = new Set(configured.map((f) => f.key));
  const candidates = [...coverage.entries()]
    .filter(
      ([k]) =>
        !used.has(k) &&
        !SYSTEM_NAMESPACE_KEY.test(k) &&
        (FILTER_HINTS.test(k) || FIELD_HINTS.squad.test(k) || FIELD_HINTS.tribu.test(k)) &&
        (samples.get(k)?.size ?? 0) >= 2,
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [key, n] of candidates) {
    items.push(
      l(
        `Could be an optional filter: "${key}" is on ${n} of ${total} namespaces${sample(key)}. Add it to EXTRA_FILTERS with scope: "namespace".`,
        `Podría ser un filtro opcional: "${key}" está en ${n} de ${total} namespaces${sample(key)}. Agrégalo a EXTRA_FILTERS con scope: "namespace".`,
      ),
    );
  }
  if (missing > 0) {
    return {
      status: "warn",
      detail: l(
        "Some namespace filters point to a label no namespace has.",
        "Algunos filtros de namespace apuntan a una label que ningún namespace tiene.",
      ),
      items,
    };
  }
  if (configured.length > 0) {
    return {
      status: "ok",
      detail: l(
        `Namespace filters found their labels (${total} namespaces scanned).`,
        `Los filtros de namespace encontraron sus labels (${total} namespaces revisados).`,
      ),
      items,
    };
  }
  return {
    status: "info",
    detail:
      candidates.length > 0
        ? l(
            `Some namespace labels could be filters (${total} namespaces scanned).`,
            `Algunas labels de namespace podrían ser filtros (${total} namespaces revisados).`,
          )
        : l(
            `Namespaces carry no labels that look like a filter (${total} scanned). Optional: nothing stops working.`,
            `Los namespaces no tienen labels que parezcan un filtro (${total} revisados). Es opcional: nada deja de funcionar.`,
          ),
    items,
  };
};

/**
 * Cost allocation de Dynatrace: `dt.cost.costcenter` y `dt.cost.product` en
 * los logs. Sin centros de costo la app funciona igual, así que nunca falla:
 * informa lo que hay. Avisa además cuando `dt.cost.product` solo repite el
 * namespace, para que nadie crea que ya tiene asignación de costos.
 */
const evaluateCostAllocation = (records: Records, lang: Lang): CheckResult => {
  const l = pick(lang);
  const r = records[0] ?? {};
  const costCenters = Number(r.costcenters ?? 0);
  const products = Number(r.products ?? 0);
  const pairs = Number(r.pairs ?? 0);
  const sameAsNamespace = Number(r.sameAsNamespace ?? 0);
  const sample = ((r.sample as unknown[] | undefined) ?? []).filter(
    (v): v is string => typeof v === "string" && v !== "",
  );
  const items: string[] = [];
  if (products > 0 && pairs > 0 && sameAsNamespace === pairs) {
    items.push(
      l(
        `dt.cost.product is set, but it always equals the namespace name (${pairs} of ${pairs}), so it adds nothing the Namespace filter and chart axis don't already show.`,
        `dt.cost.product está, pero siempre es igual al nombre del namespace (${pairs} de ${pairs}), así que no suma nada que el filtro y el eje Namespace no muestren ya.`,
      ),
    );
  }
  if (costCenters > 0) {
    const values = sample.length ? ` (${sample.join(", ")})` : "";
    items.push(
      l(
        `Dynatrace copies the cost center from a label or annotation. To filter and group by it here, add that key to EXTRA_FILTERS in ui/app/config/site.ts (scope: "namespace" if it is on the namespace). See "Cost center" in docs/SETUP.md.`,
        `Dynatrace copia el centro de costo desde una label o annotation. Para filtrar y agrupar por él aquí, agrega esa clave a EXTRA_FILTERS en ui/app/config/site.ts (scope: "namespace" si está en el namespace). Ver "Cost center" en docs/SETUP.md.`,
      ),
    );
    return {
      status: "ok",
      detail: l(
        `${costCenters} cost center(s) found in logs${values}.`,
        `${costCenters} centro(s) de costo encontrados en los logs${values}.`,
      ),
      items,
    };
  }
  return {
    status: "info",
    detail: l(
      "No cost centers (dt.cost.costcenter). Optional: everything works without them; once your organization defines them, they become a filter and a chart axis.",
      "No hay centros de costo (dt.cost.costcenter). Es opcional: todo funciona sin ellos; cuando tu organización los defina, pasan a ser un filtro y un eje de las gráficas.",
    ),
    items,
  };
};

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
    id: "k8s-workloads",
    group: "kubernetes",
    title: {
      en: "Kubernetes workloads in Smartscape",
      es: "Workloads de Kubernetes en Smartscape",
    },
    affects: {
      en: "All modules (filters, owners, Tiers)",
      es: "Todos los módulos (filtros, dueños, Tiers)",
    },
    fix: {
      en: "Every module reads workloads and their labels from Smartscape. Check that the Dynatrace Operator reports Kubernetes objects and that the app has the storage:smartscape:read scope.",
      es: "Todos los módulos leen los workloads y sus labels de Smartscape. Revisa que el Dynatrace Operator reporte los objetos de Kubernetes y que la app tenga el scope storage:smartscape:read.",
    },
    query: `${WORKLOAD_NODES} | summarize n = count()`,
    evaluate: presence(
      (n) => ({ en: `${n} workload(s) found.`, es: `${n} workload(s) encontrados.` }),
      { en: "No Kubernetes workloads found.", es: "No se encontraron workloads de Kubernetes." },
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
    // Por workload y no por servicio: es la dimensión con la que Ociosos une el
    // tráfico, y agrupar por una dimensión ausente devuelve una fila null que
    // contaba como un servicio.
    query:
      "timeseries r = sum(dt.service.request.count), by:{k8s.workload.name}, from: now()-2h | filter isNotNull(k8s.workload.name) | summarize n = count()",
    evaluate: presence(
      (n) => ({
        en: `${n} workload(s) with service requests.`,
        es: `${n} workload(s) con requests de servicios.`,
      }),
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
      en: "Owners and tiers come from the chain in ui/app/ownership/active.ts: the first source that answers wins, field by field. Pick the path that matches where your data is. The installer doesn't invent owners or tiers: when they don't exist anywhere, the organization decides them.",
      es: "Dueños y tiers salen de la cadena de ui/app/ownership/active.ts: gana la primera fuente que responde, campo por campo. Elige el camino según dónde esté tu dato. Quien instala no inventa dueños ni tiers: cuando no existen en ningún lado, los decide la organización.",
    },
    guide: OWNERSHIP_GUIDE,
    template: "ownership",
    query: `${WORKLOAD_NODES}
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
      const tier = pct(count(records, "with_tier"), total);
      const tribu = pct(count(records, "with_tribu"), total);
      const app = pct(count(records, "with_app"), total);
      const missing = l(
        "No source gives it. Fill it in the ownership table below.",
        "Ninguna fuente lo da. Complétalo en la tabla de dueños, más abajo.",
      );
      const metrics: CheckMetric[] = [
        {
          label: l("Owner (squad)", "Dueño (squad)"),
          pct: squad,
          hint: squad === 0 ? missing : undefined,
        },
        {
          label: l("Tier (business criticality)", "Tier (criticidad de negocio)"),
          pct: tier,
          hint:
            tier === 0
              ? missing
              : tier < 80
                ? l(
                    "Workloads without a tier can't be ranked by impact: the ownership table below lists them.",
                    "Los workloads sin tier no se pueden ordenar por impacto: la tabla de dueños, más abajo, los lista.",
                  )
                : undefined,
        },
        {
          label: l("Tribe / domain", "Tribu / dominio"),
          pct: tribu,
          optional: true,
          hint: l("Optional: groups teams in charts.", "Opcional: agrupa equipos en las gráficas."),
        },
        {
          label: l("App code", "Código de aplicación"),
          pct: app,
          optional: true,
          hint: l("Optional.", "Opcional."),
        },
      ];
      const items: string[] = [];
      const status: CheckStatus = squad >= 80 ? "ok" : squad >= 40 ? "warn" : "fail";
      // Con dueño pero sin ningún tier la app funciona, pero no puede ordenar
      // los hallazgos por impacto de negocio, que es la mitad de su propósito.
      if (status === "ok" && count(records, "with_tier") === 0) {
        return {
          status: "warn",
          detail: l(
            `${squad}% of ${total} workloads have an owner, but none has a tier: findings can't be ranked by business impact, and Tiers and Pending tiers show them as "no tier".`,
            `El ${squad}% de ${total} workloads tiene dueño, pero ninguno tiene tier: los hallazgos no se pueden ordenar por impacto de negocio, y Tiers y Tiers pendientes los muestran "sin tier".`,
          ),
          items,
          metrics,
        };
      }
      return {
        status,
        detail: l(
          `${squad}% of ${total} workloads have an owner.`,
          `El ${squad}% de ${total} workloads tiene dueño.`,
        ),
        items,
        metrics,
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
    query: `${WORKLOAD_NODES} | fields lbl = ${WORKLOAD_LABELS}, ann = ${WORKLOAD_ANNOTATIONS} | limit 10000`,
    maxRecords: 10000,
    guide: OWNERSHIP_GUIDE,
    evaluate: evaluateLabelDiscovery,
  },
  ...(hasLookup("ownership")
    ? [
        {
          kind: "query" as const,
          id: "ownership-table",
          group: "ownership" as const,
          title: { en: "Ownership table in Grail", es: "Tabla de dueños en Grail" },
          affects: {
            en: "Owners and tiers of every module",
            es: "Dueños y tiers de todos los módulos",
          },
          fix: {
            en: "Download the table with your current data, fix the rows listed above and upload it again. Workload names must match the cluster exactly.",
            es: "Descarga la tabla con tus datos actuales, corrige las filas de arriba y vuelve a subirla. Los nombres de workload tienen que coincidir exactamente con el cluster.",
          },
          template: "ownership" as const,
          query: `load "${LOOKUP_PATHS.ownership}"
| fields workload, tier, squad
| lookup [
    ${WORKLOAD_NODES}
    | summarize n = count(), by:{w = k8s.workload.name}
  ], sourceField:workload, lookupField:w, fields:{n}
| fields workload, tier, squad, known = isNotNull(n)
| limit 10000`,
          maxRecords: 10000,
          evaluate: evaluateOwnershipTable,
        },
      ]
    : []),
  {
    kind: "query",
    id: "namespace-labels",
    group: "ownership",
    title: { en: "Namespace labels", es: "Labels de los namespaces" },
    affects: {
      en: 'Optional filters and chart axes with scope: "namespace"',
      es: 'Filtros opcionales y ejes de las gráficas con scope: "namespace"',
    },
    fix: {
      en: 'Optional. Label your namespaces (for example with a cost center) and add the key to EXTRA_FILTERS with scope: "namespace" in ui/app/config/site.ts.',
      es: 'Opcional. Etiqueta tus namespaces (por ejemplo con un centro de costo) y agrega la clave a EXTRA_FILTERS con scope: "namespace" en ui/app/config/site.ts.',
    },
    query:
      "smartscapeNodes K8S_NAMESPACE | fields lbl = `tags:k8s.labels`, ann = `tags:k8s.annotations` | limit 10000",
    maxRecords: 10000,
    evaluate: evaluateNamespaceLabels,
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
      en: "Cost center filter and chart axis (optional)",
      es: "Filtro y eje de gráficas por centro de costo (opcional)",
    },
    fix: {
      en: 'Optional. Declare the cost center as a label on your namespaces or workloads (Dynatrace copies it to dt.cost.costcenter), then add that key to EXTRA_FILTERS. See "Cost center" in docs/SETUP.md.',
      es: 'Opcional. Declara el centro de costo como label en tus namespaces o workloads (Dynatrace lo copia a dt.cost.costcenter) y agrega esa clave a EXTRA_FILTERS. Ver "Cost center" en docs/SETUP.md.',
    },
    // En los logs y no en las métricas: en las métricas de Kubernetes no viene.
    query: `fetch logs, from: now()-1h
| filter isNotNull(dt.cost.costcenter) or isNotNull(dt.cost.product)
| summarize n = count(), by:{dt.cost.costcenter, dt.cost.product, k8s.namespace.name}
| summarize costcenters = countDistinct(dt.cost.costcenter), products = countDistinct(dt.cost.product), pairs = countIf(isNotNull(dt.cost.product)), sameAsNamespace = countIf(dt.cost.product == k8s.namespace.name), sample = collectDistinct(dt.cost.costcenter, maxLength: 5)`,
    evaluate: evaluateCostAllocation,
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
      en: 'The fastest way: fill the price table ("Template to fill" in this check) with your contract, region or on-premise prices and upload it. For list prices, set PRICE_BASE in ui/app/config/site.ts to your cloud ("azure", "aws" or "gcp"). Your own prices (the table, or INSTANCE_HOURLY_USD in site.ts) always win over the list.',
      es: 'Lo más rápido: completa la tabla de precios ("Plantilla para completar" en este chequeo) con los precios de tu contrato, tu región o tu on-premise y súbela. Para precios de lista, pon PRICE_BASE en ui/app/config/site.ts con tu nube ("azure", "aws" o "gcp"). Tus precios (la tabla, o INSTANCE_HOURLY_USD en site.ts) siempre ganan sobre la lista.',
    },
    template: "prices",
    // Con tabla de precios subida, su precio viaja en cada fila (p_table):
    // en el navegador solo se conocen los de código.
    query: `smartscapeNodes K8S_NODE | fields t = tags[\`beta.kubernetes.io/instance-type\`], region = tags[\`topology.kubernetes.io/region\`], os = tags[\`kubernetes.io/os\`] | summarize n = count(), by:{t, region, os}${
      PRICE_TABLE
        ? `
| lookup [load "${PRICE_TABLE}" | fields it = instance_type, p = toDouble(usd_per_hour)], sourceField:t, lookupField:it, fields:{p_table = p}`
        : ""
    }`,
    evaluate: (records, lang) => {
      const l = pick(lang);
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
      const n = (rows: Records) => rows.reduce((s, r) => s + Number(r.n ?? 0), 0);
      const type = (r: Records[number]) => (typeof r.t === "string" ? r.t : "");
      const priced = (r: Records[number]) => type(r) in HOURLY_USD || r.p_table != null;
      const missing = records.filter((r) => !priced(r));
      const share = pct(total - n(missing), total);
      const items: string[] = [];

      // Sin base elegida: si los tipos están en la lista de alguna nube, se
      // sugiere esa base en vez de pedir los precios uno por uno.
      if (PRICE_BASE === "none") {
        const clouds = new Map<string, number>();
        for (const r of missing) {
          const base = listBaseOf(type(r));
          if (base) clouds.set(base, (clouds.get(base) ?? 0) + Number(r.n ?? 0));
        }
        const [best] = [...clouds.entries()].sort((a, b) => b[1] - a[1]);
        if (best) {
          items.push(
            l(
              `${best[1]} of ${total} nodes have a list price in the ${best[0]} catalog: set PRICE_BASE = "${best[0]}" in ui/app/config/site.ts.`,
              `${best[1]} de ${total} nodos tienen precio de lista en el catálogo de ${best[0]}: pon PRICE_BASE = "${best[0]}" en ui/app/config/site.ts.`,
            ),
          );
        }
      }
      for (const r of missing.slice(0, 8)) {
        items.push(
          l(
            `Missing price: ${type(r) || "(no type)"} (${Number(r.n)} nodes). Add it to the price table.`,
            `Falta precio: ${type(r) || "(sin tipo)"} (${Number(r.n)} nodos). Agrégalo a la tabla de precios.`,
          ),
        );
      }

      // Lo que se valoriza con la lista y no con un precio propio: la lista es
      // Linux y de una sola región, así que se dice cuándo es aproximada.
      const list = LIST_BASE;
      if (list) {
        const fromList = records.filter(
          (r) => !(type(r) in OWN_PRICES) && r.p_table == null && type(r) in list.prices,
        );
        const regions = [
          ...new Set(
            fromList
              .map((r) => r.region)
              .filter((v): v is string => typeof v === "string" && v !== list.region),
          ),
        ];
        if (regions.length > 0) {
          items.push(
            l(
              `List prices are from ${list.region}; your nodes run in ${regions.join(", ")}. Prices differ by region, so spend is an approximation. For exact figures, upload your prices in the price table.`,
              `Los precios de lista son de ${list.region}; tus nodos corren en ${regions.join(", ")}. El precio cambia según la región, así que el gasto es aproximado. Para cifras exactas, sube tus precios en la tabla de precios.`,
            ),
          );
        }
        const windows = n(fromList.filter((r) => r.os === "windows"));
        if (windows > 0) {
          items.push(
            l(
              `${windows} Windows node(s) are priced as Linux, which is lower. Add their price to the price table.`,
              `${windows} nodo(s) Windows se valorizan como Linux, que es más barato. Agrega su precio a la tabla de precios.`,
            ),
          );
        }
      }
      items.push(l(`Prices: ${pricingSource("en")}.`, `Precios: ${pricingSource("es")}.`));

      return {
        status: share === 100 ? "ok" : "warn",
        detail:
          Object.keys(HOURLY_USD).length === 0 && !PRICE_TABLE
            ? l(
                "No prices configured: spend shows as unknown instead of wrong.",
                "No hay precios configurados: el gasto aparece como desconocido en vez de mal calculado.",
              )
            : l(
                `${share}% of ${total} nodes have a price.`,
                `El ${share}% de ${total} nodos tiene precio.`,
              ),
        items,
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
