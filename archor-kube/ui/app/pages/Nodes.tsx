import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";
import { showToast } from "@dynatrace/strato-components/notifications";

import { dotted, ModulePage } from "../components/ModulePage";
import { NodeActionChart } from "../components/NodeActionChart";
import { nodeRightsizing, nodeRightsizingSummary } from "../queries";
import {
  ASSIST_INTENT_OPTIONS,
  assistNodePayload,
  assistNodePrompt,
} from "../queries/assist";

/** Copia el prompt de Assist al portapapeles y avisa con un toast. */
const copyAssistPrompt = (row: Record<string, unknown>) => {
  navigator.clipboard
    .writeText(assistNodePrompt(row))
    .then(() =>
      showToast({
        title: "Prompt copiado",
        message: "Pégalo en una conversación nueva de Dynatrace Assist (modo agéntico).",
        type: "success",
        lifespan: 4000,
      }),
    )
    .catch(() =>
      showToast({ title: "No se pudo copiar", type: "critical", lifespan: 4000 }),
    );
};

/** Menú por fila: Assist + copiar prompt (los nodos no tienen deep link a workload). */
const nodeRowActions = (row: Record<string, unknown>) => (
  <Menu>
    <Menu.Trigger>
      <Button aria-label="Acciones de la fila">
        <DotMenuIcon />
      </Button>
    </Menu.Trigger>
    <Menu.Content>
      <Menu.Intent payload={assistNodePayload(row)} options={ASSIST_INTENT_OPTIONS}>
        Preguntar a Dynatrace Assist
      </Menu.Intent>
      <Menu.Item onSelect={() => copyAssistPrompt(row)}>
        Copiar prompt para Assist
      </Menu.Item>
    </Menu.Content>
  </Menu>
);

/** Resalta la acción: verde = candidato a eliminar (ahorro), ámbar = consolidar. */
const accionThresholds = [
  {
    comparator: "equal-to" as const,
    value: "CANDIDATO_ELIMINAR",
    color: Colors.Text.Success.Default,
    backgroundColor: Colors.Background.Container.Success.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "CONSOLIDAR_SI_ES_POSIBLE",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const nodesAbout = `## 📊 Qué muestra el reporte

Cada fila es un **nodo** con **densidad de pods < 30%** (poca ocupación real) y una acción sugerida según el contexto del clúster:

* **\`CANDIDATO_ELIMINAR\`:** el clúster tiene **más nodos que los mínimos necesarios** para correr todos sus pods, y este nodo está casi vacío (densidad < 5%). Se puede retirar.
* **\`CONSOLIDAR_SI_ES_POSIBLE\`:** densidad < 15%. Sus pods **probablemente caben en otros nodos**; consolidar y liberar.
* **\`MONITOREAR\`:** subutilizado (< 30%) pero sin un margen de acción claro todavía.

*La densidad es pods corriendo ÷ pods asignables. El cálculo de "nodos mínimos" agrupa por nodo antes de sumar (si no, el total del clúster salía 1 y nunca había candidatos).*

---

## ⚠️ ¿Por qué debería preocuparme?

Un nodo subutilizado **factura completo** —CPU y memoria asignables— aunque casi no aloje pods. La columna **Ahorro/mes** valoriza esa capacidad ociosa: es dinero que se recupera al consolidar y apagar nodos sobrantes. En un clúster con varios nodos al 16-30%, el ahorro agregado suele ser significativo.

---

## 🛠️ ¿Cómo se soluciona?

1. **\`CANDIDATO_ELIMINAR\`:** *cordon* + *drain* del nodo y retirarlo (o dejar que el **cluster-autoscaler** lo haga al bajar la carga).
2. **\`CONSOLIDAR_SI_ES_POSIBLE\`:** revisar *affinities*, *taints* y **PodDisruptionBudgets** para reubicar los pods y vaciar el nodo.
3. **Validar antes:** que no haya cargas ancladas (DaemonSets, almacenamiento local, singletons) y que el autoscaler tenga los límites correctos.

> 💡 Usa **Preguntar a Dynatrace Assist** en cada fila para un plan de consolidación con la evidencia ya cargada.

> 💡 **Ahorro/mes:** capacidad ociosa (CPU cores × 20 USD + MEM GB × 4 USD al mes, AKS Dv5 prorrateado). Orden de magnitud para priorizar, no facturación exacta.`;

export const Nodes = () => (
  <ModulePage
    title="Nodos (M4 — Densidad y consolidación)"
    about={nodesAbout}
    summaryQuery={nodeRightsizingSummary}
    summaryColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "accion", header: "Acción", accessor: "accion", thresholds: accionThresholds },
      { id: "nodos", header: "Nodos", accessor: "nodos", columnType: "number" },
      { id: "ahorro_mes_usd", header: "Ahorro/mes (USD)", accessor: "ahorro_mes_usd", columnType: "number" },
      { id: "cpu_idle_total", header: "CPU ociosa (cores)", accessor: "cpu_idle_total", columnType: "number" },
      { id: "mem_idle_total_gb", header: "MEM ociosa (GB)", accessor: "mem_idle_total_gb", columnType: "number" },
    ]}
    simple={{
      que: "Las máquinas del clúster que están medio vacías: tienen capacidad libre que ninguna aplicación pidió.",
      porque: "Cada máquina se paga completa, esté llena o vacía. Si varias están a media capacidad, se está pagando por servidores que podrían consolidarse en menos.",
      accion: "Infraestructura evalúa apagar las máquinas marcadas para eliminar o repartir sus aplicaciones en menos servidores. Antes de retirar una hay que vaciarla ordenadamente y confirmar que las aplicaciones caben en las que quedan.",
    }}
    detailQuery={nodeRightsizing}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "node", header: "Nodo", accessor: dotted("k8s.node.name"), minWidth: 240 },
      { id: "accion", header: "Acción", accessor: "accion", thresholds: accionThresholds, minWidth: 200 },
      {
        id: "ahorro_mes_usd",
        header: "Ahorro/mes (USD)",
        accessor: "ahorro_mes_usd",
        columnType: "meterbar",
        disableSorting: false,
        config: { min: 0, max: "data-max", color: Colors.Background.Container.Success.Accent, showTooltip: true },
        minWidth: 140,
      },
      {
        id: "pod_density_pct",
        header: "Densidad pods % (umbral 30)",
        accessor: "pod_density_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 30,
          showTooltip: true,
          thresholds: [
            { value: 5, color: Colors.Background.Container.Success.Accent, showIndicator: true },
          ],
        },
        minWidth: 140,
      },
      { id: "pods_running_avg", header: "Pods", accessor: "pods_running_avg", columnType: "number" },
      { id: "pods_max_avg", header: "Pods max", accessor: "pods_max_avg", columnType: "number" },
      { id: "cpu_alloc_cores", header: "CPU asignable (cores)", accessor: "cpu_alloc_cores", columnType: "number" },
      { id: "cpu_idle_pct", header: "CPU ociosa %", accessor: "cpu_idle_pct", columnType: "number" },
      { id: "mem_alloc_gb", header: "MEM asignable (GB)", accessor: "mem_alloc_gb", columnType: "number" },
      { id: "mem_idle_pct", header: "MEM ociosa %", accessor: "mem_idle_pct", columnType: "number" },
      { id: "cluster_nodos", header: "Nodos clúster", accessor: "cluster_nodos", columnType: "number" },
      { id: "nodos_minimos_cluster", header: "Nodos mínimos", accessor: "nodos_minimos_cluster", columnType: "number" },
    ]}
    rowActions={nodeRowActions}
    summaryAside={(filters) => <NodeActionChart filters={filters} />}
    detailFacets={[{ id: "accion", label: "Acción" }, { id: "k8s.cluster.name", label: "Clúster" }]}
    detailNoun="nodos subutilizados (candidatos a eliminar primero)"
  />
);
