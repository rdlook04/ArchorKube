// Regenera archor-kube/ui/app/config/listPrices.ts desde fuentes públicas.
//
//   node tools/list-prices/update.mjs
//
// Sin dependencias (Node 24, fetch nativo). Cada precio sale de la fuente;
// nada se escribe a mano. Precio de lista on-demand, Linux, una región de
// referencia por nube: es un techo razonable, no lo que factura un contrato.

import { writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const OUT = new URL("../../archor-kube/ui/app/config/listPrices.ts", import.meta.url);

// Familias que se usan como nodos de Kubernetes (propósito general, cómputo,
// memoria, burstable). Sin GPU ni HPC: sus precios varían demasiado por región
// y contrato como para que una lista sirva de referencia.
const AZURE_REGION = "eastus";
const AZURE_SKU =
  /^Standard_(B\d+(ls|s|ms|als|as|pls|ts)?_v2|B\d+m?s|[DE]\d+(a|d|s|l|p)*(ds|s)?_v[3-6]|F\d+(a|d|s)*_v[26])$/;

const AWS_REGION = "US East (N. Virginia)";
const AWS_TYPE =
  /^(t3|t3a|t4g|m5|m5a|m5d|m6i|m6id|m6a|m6g|m7i|m7a|m7g|m8g|c5|c5a|c6i|c6a|c6g|c7i|c7a|c7g|r5|r5a|r6i|r6a|r6g|r7i|r7a|r7g)\.(medium|large|\d*xlarge)$/;

const GCP_REGION = "us-central1";
const GCP_SERIES = new Set(["e2", "n1", "n2", "n2d", "n4", "c2", "c2d", "c3", "c3d", "c4", "t2d", "t2a"]);

const round = (n) => Math.round(n * 1e6) / 1e6;

/** CSV con campos entre comillas (las descripciones llevan comas). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') field += text[++i];
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(field), (field = "");
    else if (ch === "\n") row.push(field.replace(/\r$/, "")), rows.push(row), (row = []), (field = "");
    else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

async function azure() {
  const filter = [
    "serviceName eq 'Virtual Machines'",
    `armRegionName eq '${AZURE_REGION}'`,
    "priceType eq 'Consumption'",
  ].join(" and ");
  let url = `https://prices.azure.com/api/retail/prices?$filter=${encodeURIComponent(filter)}`;
  const prices = {};
  while (url) {
    const page = await (await fetch(url)).json();
    for (const i of page.Items) {
      // Linux pago por uso: fuera Windows, Spot y Low Priority.
      if (/Windows/.test(i.productName) || /Spot|Low Priority/.test(i.skuName)) continue;
      if (i.unitOfMeasure !== "1 Hour" || !AZURE_SKU.test(i.armSkuName) || i.retailPrice <= 0) continue;
      prices[i.armSkuName] = round(i.retailPrice);
    }
    url = page.NextPageLink;
  }
  return prices;
}

async function aws() {
  // El mismo JSON que carga aws.amazon.com/ec2/pricing/on-demand.
  const region = encodeURIComponent(AWS_REGION);
  const url = `https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/${region}/Linux/index.json`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString() : buf.toString();
  const prices = {};
  for (const item of Object.values(JSON.parse(text).regions[AWS_REGION])) {
    const type = item["Instance Type"];
    const price = Number(item.price);
    if (AWS_TYPE.test(type) && price > 0) prices[type] = round(price);
  }
  return prices;
}

async function gcp() {
  // gcloud-compute.com publica en CSV lo que expone la Cloud Billing API de
  // Google, que pide credenciales. Verificado contra la página oficial.
  const text = await (await fetch("https://gcloud-compute.com/machine-types-regions.csv")).text();
  const [cols, ...rows] = parseCsv(text);
  const at = (name) => cols.indexOf(name);
  const [iName, iSeries, iRegion, iHour] = ["name", "series", "region", "hour"].map(at);
  const prices = {};
  for (const c of rows) {
    if (c[iRegion] !== GCP_REGION || !GCP_SERIES.has(c[iSeries])) continue;
    const price = Number(c[iHour]);
    if (price > 0) prices[c[iName]] = round(price);
  }
  return prices;
}

const sorted = (o) =>
  Object.fromEntries(
    Object.entries(o).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })),
  );

const table = (o) =>
  Object.entries(sorted(o))
    .map(([k, v]) => `      ${JSON.stringify(k)}: ${v},`)
    .join("\n");

const [az, aw, gc] = await Promise.all([azure(), aws(), gcp()]);
for (const [name, p] of [["azure", az], ["aws", aw], ["gcp", gc]]) {
  if (Object.keys(p).length < 50) throw new Error(`${name}: solo ${Object.keys(p).length} precios`);
}
const date = new Date().toISOString().slice(0, 10);

writeFileSync(
  OUT,
  `// Generado por tools/list-prices/update.mjs el ${date}. No editar a mano:
// los precios propios van en INSTANCE_HOURLY_USD de config/site.ts.

import type { Localized } from "../i18n";

export type PriceBase = "azure" | "aws" | "gcp" | "none";

export interface ListPriceTable {
  /** Región de referencia, tal como la nombra la label topology.kubernetes.io/region. */
  region: string;
  source: Localized;
  /** USD por hora, on-demand, Linux. */
  prices: Record<string, number>;
}

export const LIST_PRICES_DATE = "${date}";

export const LIST_PRICES: Record<Exclude<PriceBase, "none">, ListPriceTable> = {
  azure: {
    region: "${AZURE_REGION}",
    source: {
      en: "Azure list price (Retail Prices API), pay-as-you-go Linux, ${AZURE_REGION}, ${date}",
      es: "Precio de lista de Azure (Retail Prices API), pago por uso Linux, ${AZURE_REGION}, ${date}",
    },
    prices: {
${table(az)}
    },
  },
  aws: {
    region: "us-east-1",
    source: {
      en: "AWS list price (EC2 on-demand pricing page), Linux, us-east-1, ${date}",
      es: "Precio de lista de AWS (página de precios on-demand de EC2), Linux, us-east-1, ${date}",
    },
    prices: {
${table(aw)}
    },
  },
  gcp: {
    region: "${GCP_REGION}",
    source: {
      en: "Google Cloud list price (Cloud Billing API via gcloud-compute.com), on-demand Linux, ${GCP_REGION}, ${date}",
      es: "Precio de lista de Google Cloud (Cloud Billing API vía gcloud-compute.com), on-demand Linux, ${GCP_REGION}, ${date}",
    },
    prices: {
${table(gc)}
    },
  },
};
`,
);
console.log(
  `listPrices.ts: azure ${Object.keys(az).length}, aws ${Object.keys(aw).length}, gcp ${Object.keys(gc).length}`,
);
