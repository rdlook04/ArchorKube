import { httpClient } from "@dynatrace-sdk/http-client";

import type { Lang, Localized } from "../i18n";
import { ownership } from "../ownership";
import { instancePriceClause } from "../queries/costModel";
import { excludedNamespacesClause } from "../queries/namespaces";
import { WORKLOAD_NODES } from "../queries/workloads";
import { runQuery } from "../setup/runQuery";
import { parseCsv, toCsv } from "./csv";
import { LOOKUP_PATHS, type LookupId } from "./lookups";

/**
 * Plantillas: todo lo que la app necesita que alguien le diga en un formato
 * fijo (dueños y tiers, precios) se completa como una tabla, no escribiendo
 * código. Setup la genera con los datos del tenant, explica cada columna y la
 * sube a Grail como lookup (desde la app o desde Dynatrace).
 *
 * Para agregar una: su ruta en `lookups.ts`, su definición aquí, y quién la
 * lee (un proveedor, una capa de precios) consultando `hasLookup`.
 */

export interface TemplateColumn {
  name: string;
  required?: boolean;
  meaning: Localized;
  example: string;
  /** Validación de una celda no vacía; devuelve el problema o null. */
  check?: (value: string) => Localized | null;
}

export interface Template {
  id: LookupId;
  path: string;
  fileName: string;
  title: Localized;
  /** Cómo funciona, en dos o tres frases: qué hace la app con la tabla. */
  howItWorks: Localized;
  columns: TemplateColumn[];
  /** Columna que identifica cada fila (el `lookupField` de Grail). */
  key: string;
  /** Consulta que precarga la plantilla; sus campos se llaman como las columnas. */
  prefill: () => string;
}

const TIER_SHAPE = /^(t|tier[-_ ]?)?\d+$/i;

export const TEMPLATES: Record<LookupId, Template> = {
  ownership: {
    id: "ownership",
    path: LOOKUP_PATHS.ownership,
    fileName: "archorkube-ownership.csv",
    title: { en: "Ownership table", es: "Tabla de dueños" },
    howItWorks: {
      en: "One row per workload with its team, tier, tribe and app code. The download already lists every workload in your clusters with what the app knows today; fill the empty cells (tier, most of the time) and upload it. What the table says wins over labels and namespaces, field by field; an empty cell leaves that field to them.",
      es: "Una fila por workload con su equipo, tier, tribu y código de aplicación. La descarga ya trae todos los workloads de tus clusters con lo que la app sabe hoy; completa las celdas vacías (el tier, casi siempre) y súbela. Lo que dice la tabla gana sobre labels y namespaces, campo por campo; una celda vacía deja ese campo a ellos.",
    },
    key: "workload",
    columns: [
      {
        name: "workload",
        required: true,
        meaning: {
          en: "Workload name (Deployment, StatefulSet…), exactly as in the cluster.",
          es: "Nombre del workload (Deployment, StatefulSet…), igual que en el cluster.",
        },
        example: "checkout-api",
      },
      {
        name: "namespace",
        meaning: {
          en: "Its namespace, to help whoever fills the table. The match is by workload name.",
          es: "Su namespace, para ayudar a quien llena la tabla. El cruce es por nombre de workload.",
        },
        example: "payments",
      },
      {
        name: "squad",
        meaning: { en: "The team that owns it.", es: "El equipo dueño." },
        example: "squad-payments",
      },
      {
        name: "tier",
        meaning: {
          en: "Business criticality: 1 = most critical. A short scale (1, 2, 3).",
          es: "Criticidad de negocio: 1 = el más crítico. Una escala corta (1, 2, 3).",
        },
        example: "1",
        check: (v) =>
          TIER_SHAPE.test(v)
            ? null
            : { en: `"${v}" isn't a tier (use 1, 2, 3)`, es: `"${v}" no es un tier (usa 1, 2, 3)` },
      },
      {
        name: "tribu",
        meaning: { en: "Tribe or business domain.", es: "Tribu o dominio de negocio." },
        example: "commerce",
      },
      {
        name: "appCode",
        meaning: {
          en: "Application code, if your organization has one.",
          es: "Código de aplicación, si tu organización lo usa.",
        },
        example: "PAY",
      },
    ],
    prefill: () => `${WORKLOAD_NODES}
| fields k8s.workload.name, k8s.namespace.name
${excludedNamespacesClause()}
${ownership.enrich("k8s.workload.name")}
| fields workload = k8s.workload.name, namespace = k8s.namespace.name, squad, tier, tribu, appCode
| sort namespace asc, workload asc
| limit 10000`,
  },
  prices: {
    id: "prices",
    path: LOOKUP_PATHS.prices,
    fileName: "archorkube-prices.csv",
    title: { en: "Instance price table", es: "Tabla de precios de instancia" },
    howItWorks: {
      en: "One row per instance type with its hourly price in USD. The download lists the types your nodes use, with the price the app applies today (empty if none). Put your contract, region or on-premise price and upload it: it wins over the cloud list price.",
      es: "Una fila por tipo de instancia con su precio por hora en USD. La descarga trae los tipos que usan tus nodos, con el precio que la app aplica hoy (vacío si no tiene). Pon el precio de tu contrato, tu región o tu on-premise y súbela: gana sobre el precio de lista de la nube.",
    },
    key: "instance_type",
    columns: [
      {
        name: "instance_type",
        required: true,
        meaning: {
          en: "Instance type, as the node label beta.kubernetes.io/instance-type shows it.",
          es: "Tipo de instancia, como lo muestra la label del nodo beta.kubernetes.io/instance-type.",
        },
        example: "Standard_D8ds_v5",
      },
      {
        name: "usd_per_hour",
        required: true,
        meaning: {
          en: "Hourly price in USD, with a dot for decimals.",
          es: "Precio por hora en USD, con punto decimal.",
        },
        example: "0.452",
        check: (v) =>
          /^\d+(\.\d+)?$/.test(v)
            ? null
            : { en: `"${v}" isn't a price (use 0.452)`, es: `"${v}" no es un precio (usa 0.452)` },
      },
      {
        name: "source",
        meaning: {
          en: "Where the price comes from, in words.",
          es: "De dónde sale el precio, en palabras.",
        },
        example: "EA contract 2026",
      },
    ],
    prefill: () => `smartscapeNodes K8S_NODE
| fields instance_type = tags[\`beta.kubernetes.io/instance-type\`]
| filter isNotNull(instance_type)
| summarize nodes = count(), by:{instance_type}
${instancePriceClause()}
| fields instance_type, usd_per_hour = precio_hora, source = ""
| sort instance_type asc`,
  },
};

/**
 * Patrón DPL que lee el CSV fijo. Cada columna acepta vacío, y la línea puede
 * terminar en \r\n (Excel en Windows): probado contra lookup:test-pattern.
 */
export const parsePattern = (template: Template): string =>
  `${template.columns.map((c) => `[^,\\r\\n]*:${c.name}`).join(" ',' ")} '\\r'? EOL`;

/** La plantilla con los datos actuales del tenant, lista para descargar. */
export const buildTemplateCsv = async (template: Template): Promise<string> => {
  const records = await runQuery(template.prefill(), 10000);
  const names = template.columns.map((c) => c.name);
  return toCsv(
    names,
    records.map((r) => names.map((n) => r[n])),
  );
};

export interface Prepared {
  csv: string;
  rows: number;
  problems: string[];
}

/**
 * Lee lo que alguien completó (cualquier orden de columnas, `,` o `;`) y lo
 * deja en la forma fija. Las columnas se reconocen por su nombre en el
 * encabezado; las que sobran se ignoran.
 */
export const prepareUpload = (template: Template, text: string, lang: Lang): Prepared => {
  const l = (en: string, es: string) => (lang === "es" ? es : en);
  const [header = [], ...data] = parseCsv(text);
  const index = header.map((h) => h.trim().toLowerCase());
  const problems: string[] = [];
  const missing = template.columns.filter(
    (c) => c.required && !index.includes(c.name.toLowerCase()),
  );
  if (missing.length > 0) {
    problems.push(
      l(
        `The header must have these columns: ${missing.map((c) => c.name).join(", ")}.`,
        `El encabezado tiene que tener estas columnas: ${missing.map((c) => c.name).join(", ")}.`,
      ),
    );
    return { csv: "", rows: 0, problems };
  }
  const rows: string[][] = [];
  data.forEach((raw, i) => {
    const row = template.columns.map((c) => {
      const at = index.indexOf(c.name.toLowerCase());
      return at >= 0 ? (raw[at] ?? "").trim() : "";
    });
    template.columns.forEach((c, j) => {
      const value = row[j];
      if (c.required && value === "") {
        problems.push(l(`Row ${i + 2}: ${c.name} is empty.`, `Fila ${i + 2}: ${c.name} está vacío.`));
      } else if (value !== "" && c.check) {
        const issue = c.check(value);
        if (issue) problems.push(l(`Row ${i + 2}: ${issue.en}.`, `Fila ${i + 2}: ${issue.es}.`));
      }
    });
    rows.push(row);
  });
  if (rows.length === 0) problems.push(l("The file has no rows.", "El archivo no tiene filas."));
  return {
    csv: toCsv(
      template.columns.map((c) => c.name),
      rows,
    ),
    rows: rows.length,
    problems,
  };
};

/**
 * Sube la tabla a Grail, reemplazando la anterior. Pide el scope
 * storage:files:write; sin él, se sube desde Dynatrace con los mismos datos.
 */
export const uploadTemplate = async (template: Template, csv: string): Promise<void> => {
  await httpClient.send({
    url: "/platform/storage/resource-store/v1/files/tabular/lookup:upload",
    method: "POST",
    requestBodyType: "form-data",
    body: [
      {
        type: "json",
        name: "request",
        value: {
          parsePattern: parsePattern(template),
          lookupField: template.key,
          filePath: template.path,
          displayName: `ArchorKube · ${template.title.en}`,
          description: "Uploaded from ArchorKube Setup",
          skippedRecords: 1,
          overwrite: true,
        },
      },
      {
        type: "binary",
        name: "content",
        filename: template.fileName,
        contentType: "text/plain",
        value: new Blob([csv], { type: "text/plain" }),
      },
    ],
  });
};
