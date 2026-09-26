import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { OrphanReasonChart } from "../components/OrphanReasonChart";
import { orphanSummary, orphanWorkloads } from "../queries";
import { assistOrphanPayload, assistOrphanPrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { orphanPractices } from "../practices/flagged";
import { RowMenu, WORKLOAD_LINK } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const OrphansRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Orphans"
    prompt={assistOrphanPrompt}
    assistPayload={assistOrphanPayload}
    practices={orphanPractices}
    links={[{ label: WORKLOAD_LINK, href: workloadUrl(row.deployment_id) }]}
  />
);

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

const orphanAboutEn = `## 📊 What the report shows

Each row is an **orphan workload**: a *Deployment* or *StatefulSet* still defined in the cluster that fits one of these two cases:

* **\`REPLICAS_0\`:** it's **scaled to zero** (0 replicas). The manifest is still there but nothing runs: it takes up inventory, shows up in dashboards and confuses whoever audits.
* **\`SIN_DUENO\`** (no owner): it's **running but its name isn't in the ownership catalog**, so it has no identifiable organizational owner (tier/squad). Nobody answers for it.

*Infrastructure namespaces (kube-system, dynatrace, etc.) are excluded.*

---

## ⚠️ Why should I care?

Orphans **erode the cluster's governance**: they inflate the inventory, clutter the reports of the other modules and, for \`SIN_DUENO\`, are workloads **with nobody responsible**: if they fail or cost money, there's no one to escalate to. Cleaning them up reduces noise and risk surface.

---

## 🛠️ How do I fix it?

1. **\`REPLICAS_0\`:** confirm with the *squad* whether scaling to zero is intentional (a temporary pause) or was forgotten; if it's the latter, **delete the manifest**.
2. **\`SIN_DUENO\`:** find out who deployed it and **register it in the ownership catalog** (assign tier/squad), or remove it if nobody claims it.

> 💡 Use **Ask Dynatrace Assist** on each row: it checks whether it's a legitimate *job*, whether there are dependencies or persistent data, and whether it's safe to remove.

*Note: this is a governance module, not a consumption one, so it shows no loss in USD or usage bars.*`;

const orphanEn: ModuleEnglish = {
  title: "Orphans (M6 — No replicas or no owner)",
  about: orphanAboutEn,
  simple: {
    que: "Things left loose: applications defined but turned off, and running applications that aren't in the organization's catalog.",
    porque:
      "The turned-off ones clutter the inventory and confuse whoever reviews. The ones missing from the catalog are worse: nobody knows whose they are, so if they fail there's no one to tell, and none of the other modules can prioritize them.",
    accion:
      "The turned-off ones get deleted if nobody needs them anymore. The ones missing from the catalog have to be registered in it with an owning team.",
  },
  detailNoun: "orphan workloads (scaled to 0 first)",
  headers: {
    motivo: "Reason",
    workloads: "Workloads",
    kind: "Kind",
    tribu: "Tribe",
    replicas: "Replicas",
  },
  facets: { motivo: "Reason" },
};

export const Orphans = () => (
  <ModulePage
    en={orphanEn}
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
    rowActions={(row) => <OrphansRowMenu row={row} />}
    summaryAside={(filters) => <OrphanReasonChart filters={filters} />}
    detailFacets={[{ id: "motivo", label: "Motivo" }]}
    detailNoun="workloads huérfanos (escalados a 0 primero)"
    filterable
  />
);
