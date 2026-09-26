import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { NodeActionChart } from "../components/NodeActionChart";
import { nodeRightsizing, nodeRightsizingSummary } from "../queries";
import { assistNodePayload, assistNodePrompt } from "../queries/assist";
import { RowMenu } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const NodesRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Nodes"
    prompt={assistNodePrompt}
    assistPayload={assistNodePayload}
  />
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

const nodesAboutEn = `## 📊 What the report shows

Each row is a **node** with **pod density < 30%** (little real occupancy) and a suggested action based on the cluster's context:

* **\`CANDIDATO_ELIMINAR\`** (candidate to remove): the cluster has **more nodes than the minimum needed** to run all its pods, and this node is almost empty (density < 5%). It can be removed.
* **\`CONSOLIDAR_SI_ES_POSIBLE\`** (consolidate if possible): density < 15%. Its pods **probably fit on other nodes**; consolidate and free it.
* **\`MONITOREAR\`** (monitor): underused (< 30%) but without a clear margin for action yet.

*Density is running pods ÷ allocatable pods. The "minimum nodes" calculation groups by node before adding up (otherwise the cluster total came out as 1 and there were never candidates).*

---

## ⚠️ Why should I care?

An underused node **is billed in full** (its allocatable CPU and memory) even if it hosts almost no pods. The **Savings/month** column values that idle capacity: it's money recovered by consolidating and turning off spare nodes. In a cluster with several nodes at 16-30%, the combined savings are usually significant.

---

## 🛠️ How do I fix it?

1. **\`CANDIDATO_ELIMINAR\`:** *cordon* + *drain* the node and remove it (or let the **cluster-autoscaler** do it when load drops).
2. **\`CONSOLIDAR_SI_ES_POSIBLE\`:** review *affinities*, *taints* and **PodDisruptionBudgets** to relocate the pods and empty the node.
3. **Check first:** that there are no pinned workloads (DaemonSets, local storage, singletons) and that the autoscaler has the right limits.

> 💡 Use **Ask Dynatrace Assist** on each row for a consolidation plan with the evidence already loaded.

> 💡 **Savings/month:** idle capacity (CPU cores × 20 USD + MEM GB × 4 USD per month, prorated AKS Dv5). An order of magnitude to prioritize, not an exact bill.`;

const nodesEn: ModuleEnglish = {
  title: "Nodes (M4 — Density and consolidation)",
  about: nodesAboutEn,
  simple: {
    que: "The cluster's machines that are half empty: they have free capacity no application asked for.",
    porque:
      "Each machine is paid for in full, whether it's full or empty. If several are at half capacity, you're paying for servers that could be consolidated into fewer.",
    accion:
      "Infrastructure evaluates turning off the machines marked for removal or spreading their applications over fewer servers. Before removing one, it has to be emptied in an orderly way, confirming the applications fit on the ones left.",
  },
  detailNoun: "underused nodes (candidates to remove first)",
  headers: {
    accion: "Action",
    nodos: "Nodes",
    ahorro_mes_usd: "Savings/month (USD)",
    cpu_idle_total: "Idle CPU (cores)",
    mem_idle_total_gb: "Idle MEM (GB)",
    node: "Node",
    pod_density_pct: "Pod density % (threshold 30)",
    pods_running_avg: "Pods",
    pods_max_avg: "Max pods",
    cpu_alloc_cores: "Allocatable CPU (cores)",
    cpu_idle_pct: "Idle CPU %",
    mem_alloc_gb: "Allocatable MEM (GB)",
    mem_idle_pct: "Idle MEM %",
    cluster_nodos: "Cluster nodes",
    nodos_minimos_cluster: "Minimum nodes",
  },
  facets: { accion: "Action", "k8s.cluster.name": "Cluster" },
};

export const Nodes = () => (
  <ModulePage
    en={nodesEn}
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
    rowActions={(row) => <NodesRowMenu row={row} />}
    summaryAside={(filters) => <NodeActionChart filters={filters} />}
    detailFacets={[{ id: "accion", label: "Acción" }, { id: "k8s.cluster.name", label: "Clúster" }]}
    detailNoun="nodos subutilizados (candidatos a eliminar primero)"
  />
);
