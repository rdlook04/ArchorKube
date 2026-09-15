import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { ModulePage } from "../components/ModulePage";
import { TierDistributionChart } from "../components/TierDistributionChart";
import { tierByRepo, tierSummary } from "../queries";
import { ownership } from "../ownership";

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

**Fuente configurada:** ${ownership.label}.

${ownership.about}

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

export const Tiers = () => (
  <ModulePage
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
