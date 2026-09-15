import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";
import { showToast } from "@dynatrace/strato-components/notifications";

import { dotted, ModulePage } from "../components/ModulePage";
import { NodeSaturationChart } from "../components/NodeSaturationChart";
import { throttlingPeaks, throttlingSummary } from "../queries";
import {
  ASSIST_INTENT_OPTIONS,
  assistThrottlePayload,
  assistThrottlePrompt,
} from "../queries/assist";
import { workloadUrl } from "../queries/links";

/** Copia el prompt de Assist al portapapeles y avisa con un toast. */
const copyAssistPrompt = (row: Record<string, unknown>) => {
  navigator.clipboard
    .writeText(assistThrottlePrompt(row))
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
const throttleRowActions = (row: Record<string, unknown>) => {
  const deploymentUrl = workloadUrl(row.deployment_id);
  return (
    <Menu>
      <Menu.Trigger>
        <Button aria-label="Acciones de la fila">
          <DotMenuIcon />
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Intent payload={assistThrottlePayload(row)} options={ASSIST_INTENT_OPTIONS}>
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

export const Bottlenecks = () => (
  <ModulePage
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
    rowActions={throttleRowActions}
    summaryAside={() => <NodeSaturationChart />}
    detailFacets={[{ id: "severidad", label: "Severidad" }]}
    detailNoun="workloads con throttling pico (severos primero)"
    filterable
  />
);
