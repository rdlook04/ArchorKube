import type { QueryDef } from "./types";
import { catalogWindow } from "./analysisWindow";
import { ownership } from "../ownership";
import { tierLookupJoin } from "./tierJoin";

/**
 * M7 — Tieraje (SPEC §4).
 *
 * El inventario de propiedad: qué servicios existen, quién los tiene y con qué
 * criticidad. Alimenta la priorización de todos los demás módulos.
 *
 * De dónde sale ese inventario lo decide el proveedor activo
 * (`ui/app/ownership/`), no este archivo. Un proveedor con catálogo propio
 * (un IDP, un lookup en Grail) lo expone en `ownership.catalog`; los que solo
 * saben resolver la propiedad workload por workload —labels, namespace— no
 * tienen catálogo que listar, y entonces el inventario se construye desde los
 * workloads que corren de verdad en el cluster.
 *
 * Esa segunda variante no es un modo degradado: lista lo que está corriendo,
 * incluido lo que nadie reclamó, que suele ser justo lo que hay que arreglar.
 */

/** Inventario derivado de los workloads vivos, para proveedores sin catálogo. */
const WORKLOAD_INVENTORY = `fetch dt.entity.cloud_application
| fields repo = entity.name
${tierLookupJoin("repo")}
| fieldsAdd application = appCode, domain = tribu
| fields repo, application, squad, tier, domain
| limit 10000`;

/** Base del inventario, según sepa el proveedor listar un catálogo o no. */
const INVENTORY = ownership.catalog ?? WORKLOAD_INVENTORY;

const SOURCE_NOTE = `${ownership.about} Sin dimensión temporal: refleja el inventario tal como está en este momento.`;

export const tierByRepo: QueryDef = {
  id: "tiering.by-repo",
  module: "tiering",
  title: "Tier por repositorio/servicio",
  description:
    "Cada servicio con su squad, tier y dominio; el nombre se une luego con el contenedor K8s",
  // El inventario puede pasar de 8k filas; sin limit explícito DQL corta en 1000.
  window: catalogWindow(SOURCE_NOTE),
  build: () => `${INVENTORY}\n| sort tier asc, squad asc, repo asc`,
};

export const tierSummary: QueryDef = {
  id: "tiering.summary",
  module: "tiering",
  title: "Resumen por tier y squad",
  description: "Cantidad de servicios por tier y squad para priorización",
  window: catalogWindow(SOURCE_NOTE),
  build: () =>
    `${INVENTORY}\n| summarize repos = count(), by:{tier, squad}\n| sort tier asc, repos desc`,
};

/** Distribución de servicios por tier (alimenta la gráfica del resumen). */
export const tierDistribution: QueryDef = {
  id: "tiering.distribution",
  module: "tiering",
  title: "Distribución de servicios por tier",
  description: "Cantidad de servicios del catálogo por tier",
  window: catalogWindow(SOURCE_NOTE),
  build: () =>
    `${INVENTORY}\n| summarize repos = count(), by:{ category = coalesce(tier, "(sin tier)") }\n| sort category asc`,
};

/** Inventario crudo, útil para diagnóstico del proveedor activo. */
export const tierLookup: QueryDef = {
  id: "tiering.lookup",
  module: "tiering",
  title: "Inventario de propiedad (crudo)",
  description:
    "Salida sin procesar de la fuente de propiedad, para verificar que el proveedor resuelve bien",
  build: () => INVENTORY,
};
