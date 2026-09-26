import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage } from "../components/ModulePage";
import { NodeHealthChart } from "../components/NodeHealthChart";
import { nodeConditions, nodeHealthSummary } from "../queries";
import { assistNodeConditionPayload, assistNodeConditionPrompt } from "../queries/assist";
import { RowMenu } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const ControlPlaneRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Control plane"
    prompt={assistNodeConditionPrompt}
    assistPayload={assistNodeConditionPayload}
  />
);

/** Resalta clústers con nodos Not Ready. */
const notReadyThresholds = [
  {
    comparator: "greater-than" as const,
    value: 0,
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];

const controlPlaneAbout = `## 📊 Qué muestra el reporte

La salud de los nodos, que en **AKS** es la ventana disponible al plano de control (el *control plane* —API server, etcd, scheduler— lo administra Azure y no se expone).

* **Resumen y gráfica:** nodos **Ready** vs **Not Ready** por clúster. Un nodo *Ready* acepta pods; uno *Not Ready* no, y sus pods se reprograman en otro lado.
* **Detalle:** solo las **condiciones problemáticas** que reporta kubelet / node-problem-detector: \`Ready≠True\`, \`MemoryPressure\`, \`DiskPressure\`, \`PIDPressure\`, \`KernelDeadlock\`, etc. **Si está vacío, todos los nodos están sanos.**

---

## ⚠️ ¿Por qué debería preocuparme?

Un nodo con presión de recursos **desaloja pods** para protegerse, y uno *Not Ready* saca de circulación toda su capacidad de golpe. Estas condiciones son señales de infraestructura que, ignoradas, se convierten en caídas de los servicios que alojan.

---

## 🛠️ ¿Cómo se soluciona?

1. **\`MemoryPressure\` / \`DiskPressure\`:** liberar o ampliar recursos del host (limpiar imágenes/logs, crecer el disco, revisar cargas que consumen de más).
2. **\`Ready≠True\`:** *cordon/drain* del nodo, revisar kubelet y el estado del host; si no se recupera, reemplazarlo.
3. **Presión recurrente:** ajustar el *cluster-autoscaler* o el tamaño del *pool* de nodos.

> 💡 Usa **Preguntar a Dynatrace Assist** en cada condición para un diagnóstico con la evidencia ya cargada.

*Nota: módulo de infraestructura a nivel nodo; no tiene tier/squad ni pérdida en USD.*`;

export const ControlPlane = () => (
  <ModulePage
    title="Control plane (M10 — Salud de nodos)"
    about={controlPlaneAbout}
    summaryQuery={nodeHealthSummary}
    summaryColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "nodos", header: "Nodos", accessor: "nodos", columnType: "number" },
      { id: "nodos_ready", header: "Ready", accessor: "nodos_ready", columnType: "number" },
      { id: "nodos_not_ready", header: "Not Ready", accessor: "nodos_not_ready", columnType: "number", thresholds: notReadyThresholds },
    ]}
    simple={{
      que: "El estado de salud de las máquinas del clúster: cuáles no están respondiendo o están sufriendo por falta de memoria, disco o procesos.",
      porque: "Una máquina enferma arrastra a todas las aplicaciones que corren en ella. Es de los pocos problemas que afectan a varios equipos a la vez sin que ninguno haya hecho nada mal.",
      accion: "Es responsabilidad de infraestructura, no de los squads. Lo normal es que esta tabla esté vacía: si aparece algo, hay que atenderlo el mismo día.",
    }}
    detailQuery={nodeConditions}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "node", header: "Nodo", accessor: dotted("k8s.node.name"), minWidth: 240 },
      { id: "condicion", header: "Condición", accessor: "condicion" },
      { id: "estado", header: "Estado", accessor: "estado" },
      { id: "razon", header: "Razón", accessor: "razon", minWidth: 180 },
      { id: "mensaje", header: "Mensaje", accessor: "mensaje", minWidth: 320, width: "2fr" },
    ]}
    rowActions={(row) => <ControlPlaneRowMenu row={row} />}
    summaryAside={() => <NodeHealthChart />}
    detailFacets={[{ id: "condicion", label: "Condición" }, { id: "k8s.cluster.name", label: "Clúster" }]}
    detailNoun="condiciones problemáticas (vacío = todo sano)"
  />
);
