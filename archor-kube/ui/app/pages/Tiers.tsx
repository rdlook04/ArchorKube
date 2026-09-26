import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { TierDistributionChart } from "../components/TierDistributionChart";
import { tierByRepo, tierSummary } from "../queries";
import { ownership, providerText } from "../ownership";

/** Resalta el tier 1 (mayor criticidad de negocio). */
const tierThresholds = [
  {
    comparator: "equal-to" as const,
    value: "1",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "2",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const tiersAbout = `## 📊 Qué muestra el reporte

El **catálogo de tieraje** que alimenta a todos los demás módulos: cada servicio con el **squad** que lo cuida, su **tier** (1/2/3) y su **dominio** (tribu).

**Fuente configurada:** ${providerText(ownership.label, "es")}.

${providerText(ownership.about, "es")}

El **nombre del servicio** es la llave: es con lo que se une al contenedor/workload de Kubernetes en los módulos de análisis, para poder atribuir cada hallazgo a un tier y un squad.

---

## ⚠️ ¿Por qué debería preocuparme?

El tier es lo que convierte una lista de hallazgos técnicos en una **cola priorizada por impacto de negocio**: un mismo problema en **tier 1** pesa mucho más que en tier 3. Si un repo **no está en el catálogo** (o su squad no tiene tier), sus workloads aparecen como \`None\` en el resto de módulos y **nadie los prioriza**. Mantener este catálogo completo y correcto es lo que hace confiable a toda la app.

---

## 🛠️ ¿Cómo se usa?

1. **Priorizar por tier:** atacar primero los hallazgos de los tiers de negocio en cada módulo.
2. **Cerrar huecos:** los repos sin tier/squad (ver también M6 Huérfanos → \`SIN_DUENO\`) deben darse de alta en el catálogo.
3. **Match nombre ↔ contenedor:** el join es por nombre exacto; lo que no matchea queda sin tier en vez de asignarse a un dueño equivocado. La cobertura real se ve en el inventario: las filas sin squad son el trabajo pendiente.

*Nota: módulo de referencia/inventario, no de hallazgos; no tiene veredicto, pérdida en USD ni acciones por fila.*`;

const tiersAboutEn = `## 📊 What the report shows

The **tiering catalog** that feeds every other module: each service with the **squad** that looks after it, its **tier** (1/2/3) and its **domain** (tribe).

**Configured source:** ${providerText(ownership.label, "en")}.

${providerText(ownership.about, "en")}

The **service name** is the key: it's what gets joined with the Kubernetes container/workload in the analysis modules, so each finding can be attributed to a tier and a squad.

---

## ⚠️ Why should I care?

The tier is what turns a list of technical findings into a **queue prioritized by business impact**: the same problem weighs much more in **tier 1** than in tier 3. If a repo **isn't in the catalog** (or its squad has no tier), its workloads show up as \`None\` in the other modules and **nobody prioritizes them**. Keeping this catalog complete and correct is what makes the whole app reliable.

---

## 🛠️ How is it used?

1. **Prioritize by tier:** tackle the findings of business tiers first in each module.
2. **Close gaps:** repos without tier/squad (see also M6 Orphans → \`SIN_DUENO\`) must be registered in the catalog.
3. **Name ↔ container match:** the join is by exact name; whatever doesn't match stays without a tier instead of being assigned to the wrong owner. The real coverage shows in the inventory: rows without a squad are the pending work.

*Note: reference/inventory module, not a findings one; it has no verdict, loss in USD or row actions.*`;

const tiersEn: ModuleEnglish = {
  title: "Tiers (M7 — Tiering)",
  about: tiersAboutEn,
  simple: {
    que: "The organization's catalog: each repository or service with the team that looks after it and how critical it is for the business.",
    porque:
      "These aren't findings; it's the base of everything else. This catalog is what lets you say 'this problem is tier 1 and belongs to squad X'. If an application isn't here, its problems show up with no owner and nobody prioritizes them.",
    accion:
      "Keep it complete. When Orphans shows applications with no owner, this is where it gets fixed: register them in the catalog with their responsible team.",
  },
  detailNoun: "repos with squad/tier",
  headers: {
    repos: "Repos",
    repo: "Repository/Service",
    application: "Application",
    domain: "Domain",
  },
  facets: { domain: "Domain" },
};

export const Tiers = () => (
  <ModulePage
    en={tiersEn}
    title="Tiers (M7 — Tieraje)"
    about={tiersAbout}
    summaryQuery={tierSummary}
    summaryColumns={[
      { id: "tier", header: "Tier", accessor: "tier", thresholds: tierThresholds },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "repos", header: "Repos", accessor: "repos", columnType: "number" },
    ]}
    simple={{
      que: "El catálogo de la organización: cada repositorio o servicio con el equipo que lo cuida y qué tan crítico es para el negocio.",
      porque: "No son hallazgos, es la base de todo lo demás. Este catálogo es lo que permite decir 'este problema es de tier 1 y es del squad tal'. Si una aplicación no está aquí, sus problemas aparecen sin dueño y nadie los prioriza.",
      accion: "Mantenerlo completo. Cuando en Huérfanos aparezcan aplicaciones sin dueño, es aquí (en el catálogo) donde se corrige, dándolas de alta con su equipo responsable.",
    }}
    detailQuery={tierByRepo}
    detailColumns={[
      { id: "repo", header: "Repositorio/Servicio", accessor: "repo", minWidth: 240 },
      { id: "application", header: "Aplicación", accessor: "application" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "tier", header: "Tier", accessor: "tier", thresholds: tierThresholds },
      { id: "domain", header: "Dominio", accessor: "domain" },
    ]}
    detailMaxRecords={10000}
    summaryAside={() => <TierDistributionChart />}
    detailFacets={[{ id: "tier", label: "Tier" }, { id: "domain", label: "Dominio" }]}
    detailNoun="repos con squad/tier"
  />
);
