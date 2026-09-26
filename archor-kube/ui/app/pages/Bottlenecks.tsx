import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { NodeSaturationChart } from "../components/NodeSaturationChart";
import { throttlingPeaks, throttlingSummary } from "../queries";
import { assistThrottlePayload, assistThrottlePrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { RowMenu, WORKLOAD_LINK } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const BottlenecksRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Bottlenecks"
    prompt={assistThrottlePrompt}
    assistPayload={assistThrottlePayload}
    links={[{ label: WORKLOAD_LINK, href: workloadUrl(row.deployment_id) }]}
  />
);

/** Resalta la severidad: rojo = severo (≥100%), ámbar = alto (≥50%). */
const severidadThresholds = [
  {
    comparator: "equal-to" as const,
    value: "SEVERO",
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

const bottlenecksAbout = `## 📊 Qué muestra el reporte

Dos ángulos de saturación de recursos:

**Tabla (workloads con CPU throttling).** Cada fila es un workload cuyo **pico** de *CPU throttling* en 24h supera el **25%** de su límite de CPU. Se usa el pico y no el promedio a propósito: los cuellos de botella son **intermitentes** y el promedio los esconde. Según el pico se marca la severidad: **\`SEVERO\`** (≥100%), **\`ALTO\`** (≥50%), **\`MODERADO\`** (>25%).

**Gráfica (saturación de nodos).** Al costado, los nodos cuyo uso de CPU o memoria del **host** supera el 80% (métrica \`dt.host.*\`, porque \`dt.kubernetes.node.*_used\` no existe en este environment).

---

## ⚠️ ¿Por qué debería preocuparme?

El *throttling* significa que el workload **quiere más CPU de la que su límite le permite**: rinde por debajo de su capacidad y acumula latencia, aunque el nodo tenga CPU de sobra. Es una degradación silenciosa que golpea la experiencia sin generar una caída visible. Un nodo saturado, en cambio, amenaza a **todos** los pods que aloja.

---

## 🛠️ ¿Cómo se soluciona?

1. **Throttling:** **subir (o quitar) el \`limits.cpu\`** del contenedor si el nodo tiene margen, o **escalar horizontalmente con HPA** si la carga es sostenida.
2. **Validar antes:** confirmar si el pico coincide con arranque o *batch* (aceptable) o es carga real continua; revisar si ya hay un HPA activo.
3. **Nodos saturados:** redistribuir carga o sumar capacidad al *pool*.

> 💡 Usa **Preguntar a Dynatrace Assist** en cada fila para un plan de ajuste con la evidencia ya cargada.

*Nota: módulo de rendimiento; el impacto es latencia/degradación, no un costo mensual, por eso no muestra USD.*`;

const bottlenecksAboutEn = `## 📊 What the report shows

Two angles of resource saturation:

**Table (workloads with CPU throttling).** Each row is a workload whose **peak** *CPU throttling* over 24h exceeds **25%** of its CPU limit. The peak is used instead of the average on purpose: bottlenecks are **intermittent** and the average hides them. The peak sets the severity: **\`SEVERO\`** (severe, ≥100%), **\`ALTO\`** (high, ≥50%), **\`MODERADO\`** (moderate, >25%).

**Chart (node saturation).** Beside it, the nodes whose **host** CPU or memory usage exceeds 80% (metric \`dt.host.*\`, because \`dt.kubernetes.node.*_used\` doesn't exist in this environment).

---

## ⚠️ Why should I care?

*Throttling* means the workload **wants more CPU than its limit allows**: it performs below its capacity and builds up latency, even when the node has CPU to spare. It's a silent degradation that hurts the experience without causing a visible outage. A saturated node, on the other hand, threatens **every** pod it hosts.

---

## 🛠️ How do I fix it?

1. **Throttling:** **raise (or remove) the container's \`limits.cpu\`** if the node has room, or **scale horizontally with an HPA** if the load is sustained.
2. **Check first:** confirm whether the peak matches startup or a *batch* (acceptable) or is continuous real load; check whether an HPA is already active.
3. **Saturated nodes:** spread the load or add capacity to the *pool*.

> 💡 Use **Ask Dynatrace Assist** on each row for an adjustment plan with the evidence already loaded.

*Note: performance module; the impact is latency/degradation, not a monthly cost, so it shows no USD.*`;

const bottlenecksEn: ModuleEnglish = {
  title: "Bottlenecks (M11 — Throttling and saturation)",
  about: bottlenecksAboutEn,
  simple: {
    que: "Applications the system is slowing down on purpose because they want more CPU than their cap allows, and machines running at the limit of their capacity.",
    porque:
      "Throttling feels like slowness: the application works, but answers late. It's one of the problems that bothers users most and gets detected least, because nothing goes down or throws an error.",
    accion:
      "The squad raises the CPU cap of the throttled application, or removes the cap if its load is irregular. First, tell whether the peak was a one-off process or the throttling is constant.",
  },
  detailNoun: "workloads with peak throttling (severe first)",
  headers: {
    severidad: "Severity",
    workloads: "Workloads",
    peak_max_pct: "Max peak %",
    limit_avg: "CPU limit (mc)",
    throttle_peak: "Peak throttle (mc)",
    throttle_peak_pct: "Peak vs limit % (threshold 25)",
  },
  facets: { severidad: "Severity" },
};

export const Bottlenecks = () => (
  <ModulePage
    en={bottlenecksEn}
    title="Cuellos de botella (M11 — Throttling y saturación)"
    about={bottlenecksAbout}
    summaryQuery={throttlingSummary}
    summaryColumns={[
      { id: "severidad", header: "Severidad", accessor: "severidad", thresholds: severidadThresholds },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "workloads", header: "Workloads", accessor: "workloads", columnType: "number" },
      { id: "peak_max_pct", header: "Pico máx %", accessor: "peak_max_pct", columnType: "number" },
    ]}
    simple={{
      que: "Aplicaciones a las que el sistema está frenando a propósito porque quieren más CPU de la que su tope les permite, y máquinas que están al límite de su capacidad.",
      porque: "El frenado se siente como lentitud: la aplicación funciona, pero responde tarde. Es de los problemas que más molestan al usuario y de los que menos se detectan, porque nada se cae ni da error.",
      accion: "El squad sube el tope de CPU de la aplicación frenada, o le quita el tope si su carga es irregular. Antes conviene distinguir si el pico fue un proceso puntual o si el frenado es constante.",
    }}
    detailQuery={throttlingPeaks}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "workload", header: "Workload", accessor: dotted("k8s.workload.name"), minWidth: 220 },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "severidad", header: "Severidad", accessor: "severidad", thresholds: severidadThresholds, minWidth: 140 },
      { id: "limit_avg", header: "Límite CPU (mc)", accessor: "limit_avg", columnType: "number" },
      { id: "throttle_peak", header: "Throttle pico (mc)", accessor: "throttle_peak", columnType: "number" },
      {
        id: "throttle_peak_pct",
        header: "Pico vs límite % (umbral 25)",
        accessor: "throttle_peak_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: "data-max",
          color: Colors.Background.Container.Critical.Accent,
          showTooltip: true,
          thresholds: [
            { value: 100, color: Colors.Background.Container.Critical.Accent, showIndicator: true },
          ],
        },
        minWidth: 160,
      },
    ]}
    rowActions={(row) => <BottlenecksRowMenu row={row} />}
    summaryAside={() => <NodeSaturationChart />}
    detailFacets={[{ id: "severidad", label: "Severidad" }]}
    detailNoun="workloads con throttling pico (severos primero)"
    filterable
  />
);
