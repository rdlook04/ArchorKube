import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";
import { showToast } from "@dynatrace/strato-components/notifications";

import { dotted, ModulePage } from "../components/ModulePage";
import { OrphanReasonChart } from "../components/OrphanReasonChart";
import { orphanSummary, orphanWorkloads } from "../queries";
import {
  ASSIST_INTENT_OPTIONS,
  assistOrphanPayload,
  assistOrphanPrompt,
} from "../queries/assist";
import { workloadUrl } from "../queries/links";

/** Copia el prompt de Assist al portapapeles y avisa con un toast. */
const copyAssistPrompt = (row: Record<string, unknown>) => {
  navigator.clipboard
    .writeText(assistOrphanPrompt(row))
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

/** Menú por fila: Assist + copiar prompt + deep link al workload. */
const orphanRowActions = (row: Record<string, unknown>) => {
  const deploymentUrl = workloadUrl(row.deployment_id);
  return (
    <Menu>
      <Menu.Trigger>
        <Button aria-label="Acciones de la fila">
          <DotMenuIcon />
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Intent payload={assistOrphanPayload(row)} options={ASSIST_INTENT_OPTIONS}>
          Preguntar a Dynatrace Assist
        </Menu.Intent>
        <Menu.Item onSelect={() => copyAssistPrompt(row)}>
          Copiar prompt para Assist
        </Menu.Item>
        <Menu.Link href={deploymentUrl ?? undefined} target="_blank" disabled={!deploymentUrl}>
          Abrir workload (Kubernetes)
        </Menu.Link>
      </Menu.Content>
    </Menu>
  );
};

/** Resalta el motivo: ámbar = escalado a 0, rojo = sin dueño. */
const motivoThresholds = [
  {
    comparator: "equal-to" as const,
    value: "REPLICAS_0",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "SIN_DUENO",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];

const orphanAbout = `## 📊 Qué muestra el reporte

Cada fila es un **workload huérfano**: un *Deployment* o *StatefulSet* que sigue definido en el clúster pero encaja en uno de estos dos casos:

* **\`REPLICAS_0\`:** Está **escalado a cero** (0 réplicas). El manifiesto sigue vivo pero no corre nada: ocupa inventario, aparece en dashboards y confunde a quien audita.
* **\`SIN_DUENO\`:** Está **corriendo pero su nombre no existe en el catálogo de propiedad**, así que no tiene un dueño organizacional (tier/squad) identificable. Nadie responde por él.

*Se excluyen los namespaces de infraestructura (kube-system, dynatrace, etc.).*

---

## ⚠️ ¿Por qué debería preocuparme?

Los huérfanos **degradan la gobernanza** del clúster: inflan el inventario, ensucian los reportes de los demás módulos y, en el caso de los \`SIN_DUENO\`, representan cargas **sin responsable** —si fallan o generan costo, no hay a quién escalar—. Limpiarlos reduce ruido y superficie de riesgo.

---

## 🛠️ ¿Cómo se soluciona?

1. **\`REPLICAS_0\`:** confirmar con el *squad* si el escalado a cero es intencional (pausa temporal) o quedó olvidado; si es lo segundo, **borrar el manifiesto**.
2. **\`SIN_DUENO\`:** identificar quién lo desplegó y **darle de alta en el catálogo de propiedad** (asignar tier/squad), o retirarlo si nadie lo reclama.

> 💡 Usa **Preguntar a Dynatrace Assist** en cada fila: valida si es un *job* legítimo, si hay dependencias o datos persistentes, y si es seguro retirarlo.

*Nota: este módulo es de gobernanza, no de consumo, por eso no muestra pérdida en USD ni barras de uso.*`;

export const Orphans = () => (
  <ModulePage
    title="Huérfanos (M6 — Sin réplicas o sin dueño)"
    about={orphanAbout}
    summaryQuery={orphanSummary}
    summaryColumns={[
      { id: "motivo", header: "Motivo", accessor: "motivo", thresholds: motivoThresholds },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "workloads", header: "Workloads", accessor: "workloads", columnType: "number" },
    ]}
    simple={{
      que: "Cosas que quedaron sueltas: aplicaciones definidas pero apagadas, y aplicaciones corriendo que no figuran en el catálogo de la organización.",
      porque: "Las apagadas ensucian el inventario y confunden a quien revisa. Las que no figuran en el catálogo son peores: nadie sabe de quién son, así que si fallan no hay a quién avisarle y ninguno de los otros módulos las puede priorizar.",
      accion: "Las apagadas se borran si ya nadie las necesita. Las que no figuran en el catálogo hay que darlas de alta en el catálogo asignándoles un equipo dueño.",
    }}
    detailQuery={orphanWorkloads}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "workload", header: "Workload", accessor: dotted("k8s.workload.name"), minWidth: 220 },
      { id: "kind", header: "Kind", accessor: dotted("k8s.workload.kind") },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "tribu", header: "Tribu", accessor: "tribu" },
      { id: "replicas", header: "Réplicas", accessor: "replicas", columnType: "number" },
      { id: "motivo", header: "Motivo", accessor: "motivo", thresholds: motivoThresholds, minWidth: 160 },
    ]}
    rowActions={orphanRowActions}
    summaryAside={(filters) => <OrphanReasonChart filters={filters} />}
    detailFacets={[{ id: "motivo", label: "Motivo" }]}
    detailNoun="workloads huérfanos (escalados a 0 primero)"
    filterable
  />
);
