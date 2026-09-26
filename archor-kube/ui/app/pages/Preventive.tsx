import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";
import { showToast } from "@dynatrace/strato-components/notifications";

import { dotted, ModulePage } from "../components/ModulePage";
import { PreventiveSignalChart } from "../components/PreventiveSignalChart";
import { preventiveSignals, preventiveSummary } from "../queries";
import {
  ASSIST_INTENT_OPTIONS,
  assistPreventivePayload,
  assistPreventivePrompt,
} from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { preventivePractices, useOpenGuide } from "../practices/flagged";

/** Copia el prompt de Assist al portapapeles y avisa con un toast. */
const copyAssistPrompt = (row: Record<string, unknown>) => {
  navigator.clipboard
    .writeText(assistPreventivePrompt(row))
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
const PreventiveRowMenu = ({ row }: { row: Record<string, unknown> }) => {
  const openGuide = useOpenGuide();
  const flagged = preventivePractices(row);
  const deploymentUrl = workloadUrl(row.deployment_id);
  return (
    <Menu>
      <Menu.Trigger>
        <Button aria-label="Acciones de la fila">
          <DotMenuIcon />
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Item disabled={flagged.length === 0} onSelect={() => openGuide(flagged, row)}>
          Why is this flagged?
        </Menu.Item>
        <Menu.Intent payload={assistPreventivePayload(row)} options={ASSIST_INTENT_OPTIONS}>
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

/** Resalta la señal: rojo = OOM/restart loop, ámbar = restarts elevados. */
const senalThresholds = [
  {
    comparator: "equal-to" as const,
    value: "OOM_KILL",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "RESTART_LOOP",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "RESTARTS_ELEVADOS",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

/** Celda: OOM > 0 y restarts > 10 se pintan solas. */
const oomThresholds = [
  {
    comparator: "greater-than" as const,
    value: 0,
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];
const restartsThresholds = [
  {
    comparator: "greater-than" as const,
    value: 10,
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];

const preventiveAbout = `## 📊 Qué muestra el reporte

Cada fila es un **workload** que dio señales tempranas de degradación en las **últimas 24 horas**, *antes* de convertirse en un incidente. Se clasifica en:

* **\`OOM_KILL\`:** Al menos un contenedor fue **matado por falta de memoria** (superó su *limit*). Es el síntoma más grave.
* **\`RESTART_LOOP\`:** Se reinicia en bucle (**>10 reinicios** en 24h). Suele indicar un crash de arranque, una *probe* mal configurada o una dependencia caída.
* **\`RESTARTS_ELEVADOS\`:** Reinicios frecuentes (**>3** en 24h) sin llegar al bucle.

*Para el OOM se incluye el contexto de memoria: uso promedio vs. límite (**Uso vs límite %**), la pista clave para distinguir "límite bajo" de "fuga de memoria".*

---

## ⚠️ ¿Por qué debería preocuparme?

Estas señales son **la antesala de una caída**. Un \`OOM_KILL\` recurrente degrada la disponibilidad de forma intermitente (el pod muere y vuelve, perdiendo peticiones en curso); un \`RESTART_LOOP\` puede dejar el servicio efectivamente fuera. Atenderlas ahora evita el incidente —y la llamada a las 3 a.m.— más adelante.

*Nota: los reinicios se miden como el incremento real del contador en la ventana (no la suma de muestras), y se incluyen también los restart loops sin OOM (antes el reporte solo mostraba OOM por una limitación de la consulta).*

---

## 🛠️ ¿Cómo se soluciona?

Depende de la señal:

1. **OOM con uso ≈ límite:** el límite de memoria es **demasiado bajo** para la carga real → subirlo (ver M1/M2 Rightsizing) tras confirmar que no es una fuga.
2. **OOM con uso creciente en el tiempo:** sospecha de **fuga de memoria** → revisar el código/heap, no solo subir el límite.
3. **RESTART_LOOP:** revisar logs de arranque, *readiness/liveness probes* (timeouts, rutas) y dependencias externas.

> 💡 Usa el botón **Preguntar a Dynatrace Assist** en cada fila para un diagnóstico guiado con la evidencia ya cargada.`;

export const Preventive = () => (
  <ModulePage
    title="Preventiva (M8 — Restarts y OOM kills)"
    about={preventiveAbout}
    summaryQuery={preventiveSummary}
    summaryColumns={[
      { id: "senal", header: "Señal", accessor: "senal", thresholds: senalThresholds },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "workloads", header: "Workloads", accessor: "workloads", columnType: "number" },
    ]}
    simple={{
      que: "Aplicaciones que se están cayendo solas: o el sistema las mata porque se quedan sin memoria, o se reinician una y otra vez.",
      porque: "Es inestabilidad que ya está ocurriendo, no un riesgo futuro. Cada caída pierde lo que la aplicación estuviera haciendo y los usuarios ven errores intermitentes, de esos difíciles de reportar.",
      accion: "El squad revisa por qué se queda sin memoria: puede ser que necesite más de la que tiene asignada, o que tenga una fuga que la va consumiendo. Los reinicios en bucle casi siempre son un error de arranque o una dependencia caída.",
    }}
    detailQuery={preventiveSignals}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "workload", header: "Workload", accessor: dotted("k8s.workload.name"), minWidth: 200 },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "senal", header: "Señal", accessor: "senal", thresholds: senalThresholds, minWidth: 160 },
      {
        id: "ooms_24h",
        header: "OOM kills 24h",
        accessor: "ooms_24h",
        columnType: "number",
        thresholds: oomThresholds,
      },
      {
        id: "restarts_24h",
        header: "Restarts 24h",
        accessor: "restarts_24h",
        columnType: "meterbar",
        disableSorting: false,
        config: { min: 0, max: "data-max", color: Colors.Background.Container.Critical.Accent, showTooltip: true },
        minWidth: 140,
      },
      { id: "restarts_num", header: "Restarts (n)", accessor: "restarts_24h", columnType: "number", thresholds: restartsThresholds },
      { id: "mem_avg_mb", header: "MEM uso avg (MB)", accessor: "mem_avg_mb", columnType: "number" },
      { id: "mem_limit_mb", header: "MEM límite (MB)", accessor: "mem_limit_mb", columnType: "number" },
      {
        id: "mem_uso_pct",
        header: "Uso vs límite %",
        accessor: "mem_uso_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 100,
          showTooltip: true,
          thresholds: [
            { value: 90, color: Colors.Background.Container.Critical.Accent, showIndicator: true },
          ],
        },
        minWidth: 120,
      },
    ]}
    rowActions={(row) => <PreventiveRowMenu row={row} />}
    summaryAside={(filters) => <PreventiveSignalChart filters={filters} />}
    detailFacets={[{ id: "senal", label: "Señal" }]}
    detailNoun="workloads con señales preventivas (OOM primero)"
    filterable
  />
);
