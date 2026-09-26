import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { RiskLevelChart } from "../components/RiskLevelChart";
import { workloadRisk, workloadRiskSummary } from "../queries";
import { assistRiskPayload, assistRiskPrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { riskPractices } from "../practices/flagged";
import { RowMenu, WORKLOAD_LINK } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const RiskRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Risk"
    prompt={assistRiskPrompt}
    assistPayload={assistRiskPayload}
    practices={riskPractices}
    links={[{ label: WORKLOAD_LINK, href: workloadUrl(row.deployment_id) }]}
  />
);

/** Resalta el nivel: rojo = crítico (3 factores), ámbar = alto (2). */
const nivelThresholds = [
  {
    comparator: "equal-to" as const,
    value: "CRITICO",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "ALTO",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

/** Celda: cada factor de fragilidad se pinta cuando falta. */
const singleReplicaThresholds = [
  {
    comparator: "equal-to" as const,
    value: "SI",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];
const gapThresholds = [
  {
    comparator: "equal-to" as const,
    value: "FALTA",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const riskAbout = `## 📊 Qué muestra el reporte

Cada fila es un **Deployment o StatefulSet** con al menos un factor de fragilidad ante caídas. El **score (1-3)** suma tres condiciones independientes:

* **Réplica única:** corre con **un solo pod**. Si ese pod cae (o su nodo), el servicio queda fuera —no hay redundancia—.
* **Sin *liveness probe*:** Kubernetes **no sabe reiniciar** un contenedor colgado (vivo pero sin responder).
* **Sin *readiness probe*:** Kubernetes **envía tráfico** al pod aunque todavía no esté listo, provocando errores durante el arranque.

Según el score se asigna un nivel: **\`CRITICO\`** (3 factores), **\`ALTO\`** (2), **\`MEDIO\`** (1). *Los workloads sin ningún factor (score 0) no aparecen: no tienen riesgo.*

---

## ⚠️ ¿Por qué debería preocuparme?

Estos workloads **están un incidente de distancia** de una interrupción. Una réplica única no tolera el mantenimiento de un nodo ni un despliegue; la falta de *probes* convierte un cuelgue en downtime silencioso. El impacto se multiplica por el **tier**: un \`CRITICO\` en tier 1 es una caída de negocio esperando ocurrir.

---

## 🛠️ ¿Cómo se soluciona?

1. **Réplica única:** subir a **≥2 réplicas** y añadir un **PodDisruptionBudget** para sobrevivir al mantenimiento de nodos (salvo *singletons* legítimos como algunos StatefulSets).
2. **Probes faltantes:** definir **liveness** y **readiness** en cada contenedor (con *endpoints* y *timeouts* correctos).
3. **Priorizar por tier:** atacar primero los \`CRITICO\` y \`ALTO\` de los tiers de negocio.

> 💡 Usa **Preguntar a Dynatrace Assist** en cada fila para un plan de remediación con la evidencia ya cargada.

*Nota: módulo de disponibilidad/resiliencia, no de consumo, por eso no muestra pérdida en USD.*`;

const riskAboutEn = `## 📊 What the report shows

Each row is a **Deployment or StatefulSet** with at least one fragility factor. The **score (1-3)** adds up three independent conditions:

* **Single replica:** it runs with **only one pod**. If that pod (or its node) goes down, the service is out; there's no redundancy.
* **No *liveness probe*:** Kubernetes **can't restart** a hung container (alive but not answering).
* **No *readiness probe*:** Kubernetes **sends traffic** to the pod before it's ready, causing errors during startup.

The score sets a level: **\`CRITICO\`** (critical, 3 factors), **\`ALTO\`** (high, 2), **\`MEDIO\`** (medium, 1). *Workloads with no factor (score 0) don't show up: they carry no risk.*

---

## ⚠️ Why should I care?

These workloads **are one incident away** from an outage. A single replica can't survive node maintenance or a deploy; missing *probes* turn a hang into silent downtime. The impact is multiplied by the **tier**: a \`CRITICO\` in tier 1 is a business outage waiting to happen.

---

## 🛠️ How do I fix it?

1. **Single replica:** go to **≥2 replicas** and add a **PodDisruptionBudget** to survive node maintenance (except legitimate *singletons* such as some StatefulSets).
2. **Missing probes:** define **liveness** and **readiness** on every container (with the right *endpoints* and *timeouts*).
3. **Prioritize by tier:** tackle the \`CRITICO\` and \`ALTO\` ones in business tiers first.

> 💡 Use **Ask Dynatrace Assist** on each row for a remediation plan with the evidence already loaded.

*Note: this is an availability/resilience module, not a consumption one, so it shows no loss in USD.*`;

const riskEn: ModuleEnglish = {
  title: "Outage risk (M5 — Workloads)",
  about: riskAboutEn,
  simple: {
    que: "Applications with only one copy running, or that nobody is checking the pulse of.",
    porque:
      "With a single copy, any failure or maintenance leaves the service down: there's no one to serve while it comes back up. Without a health check, the system keeps sending users to a copy that no longer answers.",
    accion:
      "The squad raises tier 1 applications to two or more copies and adds the health checks. It's the cheapest fix in this app: it's configuration, not development.",
  },
  detailNoun: "workloads at risk of an outage (highest score first)",
  headers: {
    nivel: "Level",
    risk_score: "Score (0-3)",
    workloads: "Workloads",
    kind: "Kind",
    replicas: "Replicas",
    single_replica: "Single replica",
    liveness_gap: "Liveness",
    readiness_gap: "Readiness",
  },
  facets: { nivel: "Level" },
};

export const Risk = () => (
  <ModulePage
    en={riskEn}
    title="Riesgo de caída (M5 — Workloads)"
    about={riskAbout}
    summaryQuery={workloadRiskSummary}
    summaryColumns={[
      { id: "nivel", header: "Nivel", accessor: "nivel", thresholds: nivelThresholds },
      { id: "risk_score", header: "Score", accessor: "risk_score", columnType: "number" },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "workloads", header: "Workloads", accessor: "workloads", columnType: "number" },
    ]}
    simple={{
      que: "Aplicaciones que tienen una sola copia corriendo, o a las que nadie les revisa el pulso.",
      porque: "Con una sola copia, cualquier falla o mantenimiento deja el servicio caído: no hay quien atienda mientras vuelve a levantar. Sin chequeo de salud, el sistema le sigue mandando usuarios a una copia que ya no responde.",
      accion: "El squad sube a dos o más copias las aplicaciones de tier 1 y les agrega los chequeos de salud. Es la corrección más barata de esta app: es configuración, no desarrollo.",
    }}
    detailQuery={workloadRisk}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "workload", header: "Workload", accessor: dotted("k8s.workload.name"), minWidth: 220 },
      { id: "kind", header: "Kind", accessor: dotted("k8s.workload.kind") },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "nivel", header: "Nivel", accessor: "nivel", thresholds: nivelThresholds, minWidth: 120 },
      {
        id: "risk_score",
        header: "Score (0-3)",
        // Grail serializa el entero como string; la meterbar necesita número.
        accessor: (row: Record<string, unknown>) => Number(row.risk_score ?? 0),
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 3,
          showTooltip: true,
          thresholds: [
            { value: 3, color: Colors.Background.Container.Critical.Accent, showIndicator: true },
          ],
        },
        minWidth: 120,
      },
      { id: "replicas", header: "Réplicas", accessor: "replicas", columnType: "number" },
      { id: "single_replica", header: "Réplica única", accessor: "single_replica", thresholds: singleReplicaThresholds },
      { id: "liveness_gap", header: "Liveness", accessor: "liveness_gap", thresholds: gapThresholds },
      { id: "readiness_gap", header: "Readiness", accessor: "readiness_gap", thresholds: gapThresholds },
    ]}
    rowActions={(row) => <RiskRowMenu row={row} />}
    summaryAside={(filters) => <RiskLevelChart filters={filters} />}
    detailFacets={[{ id: "nivel", label: "Nivel" }]}
    detailNoun="workloads con riesgo de caída (score alto primero)"
    filterable
  />
);
