import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage } from "../components/ModulePage";
import { RiskLevelChart } from "../components/RiskLevelChart";
import { workloadRisk, workloadRiskSummary } from "../queries";
import { assistRiskPayload, assistRiskPrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { riskPractices } from "../practices/flagged";
import { RowMenu } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const RiskRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Risk"
    prompt={assistRiskPrompt}
    assistPayload={assistRiskPayload}
    practices={riskPractices}
    links={[{ label: "Abrir workload (Kubernetes)", href: workloadUrl(row.deployment_id) }]}
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

export const Risk = () => (
  <ModulePage
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
