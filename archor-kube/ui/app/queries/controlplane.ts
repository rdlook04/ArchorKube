import type { QueryDef } from "./types";
import { snapshotWindow } from "./analysisWindow";

/**
 * M10 — Control plane / salud de nodos (SPEC §4).
 * En AKS el control plane es administrado por Azure; la visibilidad disponible
 * son las condiciones que kubelet/node-problem-detector reportan por nodo
 * (Ready, MemoryPressure, DiskPressure, PIDPressure, KernelDeadlock, etc.),
 * leídas del objeto K8S_NODE en smartscape. Validado: 152 nodos, 12 tipos de
 * condición. Solo se listan condiciones problemáticas.
 */
export const nodeConditions: QueryDef = {
  id: "controlplane.node-conditions",
  module: "control-plane",
  title: { en: "Problem node conditions", es: "Condiciones problemáticas de nodos" },
  description:
    { en: "Nodes that are NotReady or under memory/disk/PID pressure or other active conditions", es: "Nodos NotReady o con presión de memoria/disco/PID u otras condiciones activas" },
  window: snapshotWindow(
    { en: "Snapshot of the current nodes (smartscape): the conditions they report right now, no history.", es: "Foto del estado actual de los nodos (smartscape): las condiciones que reportan en este momento, sin histórico." },
  ),
  build: () => `smartscapeNodes K8S_NODE
| parse k8s.object, "JSON:config"
| expand cond = config[\`status\`][\`conditions\`]
| fieldsAdd
    condicion = cond[\`type\`],
    estado    = cond[\`status\`],
    razon     = cond[\`reason\`],
    mensaje   = cond[\`message\`]
| filter (condicion == "Ready" and estado != "True")
      or (condicion != "Ready" and estado == "True")
| sort condicion asc
| fields k8s.cluster.name, k8s.node.name, condicion, estado, razon, mensaje`,
};

/** Salud global: total de nodos y nodos Ready por clúster. */
export const nodeHealthSummary: QueryDef = {
  id: "controlplane.health",
  module: "control-plane",
  title: { en: "Node health by cluster", es: "Salud de nodos por clúster" },
  description: { en: "Total nodes and Ready nodes by cluster", es: "Total de nodos y nodos Ready por clúster" },
  window: snapshotWindow(
    { en: "Snapshot of the current nodes (smartscape), no history.", es: "Foto del estado actual de los nodos (smartscape), sin histórico." },
  ),
  build: () => `smartscapeNodes K8S_NODE
| parse k8s.object, "JSON:config"
| expand cond = config[\`status\`][\`conditions\`]
| filter cond[\`type\`] == "Ready"
| fieldsAdd ready = if(cond[\`status\`] == "True", 1, else: 0)
| summarize nodos = count(), nodos_ready = sum(ready), by:{k8s.cluster.name}
| fieldsAdd nodos_not_ready = nodos - nodos_ready`,
};
