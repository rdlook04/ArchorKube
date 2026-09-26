import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { PreventiveSignalChart } from "../components/PreventiveSignalChart";
import { preventiveSignals, preventiveSummary } from "../queries";
import { assistPreventivePayload, assistPreventivePrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { preventivePractices } from "../practices/flagged";
import { RowMenu, WORKLOAD_LINK } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const PreventiveRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Preventive"
    prompt={assistPreventivePrompt}
    assistPayload={assistPreventivePayload}
    practices={preventivePractices}
    links={[{ label: WORKLOAD_LINK, href: workloadUrl(row.deployment_id) }]}
  />
);

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

const preventiveAboutEn = `## 📊 What the report shows

Each row is a **workload** that gave early signs of degradation in the **last 24 hours**, *before* it became an incident. It falls into:

* **\`OOM_KILL\`:** at least one container was **killed for running out of memory** (it went over its *limit*). The most serious symptom.
* **\`RESTART_LOOP\`:** it restarts in a loop (**>10 restarts** in 24h). Usually a startup crash, a misconfigured *probe* or a dependency that's down.
* **\`RESTARTS_ELEVADOS\`** (elevated restarts): frequent restarts (**>3** in 24h) without reaching a loop.

*For OOM, the memory context is included: average usage vs. limit (**Usage vs limit %**), the key clue to tell "limit too low" from "memory leak".*

---

## ⚠️ Why should I care?

These signals are **the lead-up to an outage**. A recurring \`OOM_KILL\` degrades availability intermittently (the pod dies and comes back, losing requests in flight); a \`RESTART_LOOP\` can leave the service effectively down. Handling them now avoids the incident, and the 3 a.m. call, later.

*Note: restarts are measured as the real increase of the counter in the window (not the sum of samples), and restart loops without OOM are included too (the report used to show only OOM because of a query limitation).*

---

## 🛠️ How do I fix it?

It depends on the signal:

1. **OOM with usage ≈ limit:** the memory limit is **too low** for the real load → raise it (see M1/M2 Rightsizing) after confirming it isn't a leak.
2. **OOM with usage growing over time:** a suspected **memory leak** → look at the code/heap, don't just raise the limit.
3. **RESTART_LOOP:** check the startup logs, the *readiness/liveness probes* (timeouts, paths) and external dependencies.

> 💡 Use **Ask Dynatrace Assist** on each row for a guided diagnosis with the evidence already loaded.`;

const preventiveEn: ModuleEnglish = {
  title: "Preventive (M8 — Restarts and OOM kills)",
  about: preventiveAboutEn,
  simple: {
    que: "Applications that are going down on their own: either the system kills them because they run out of memory, or they restart again and again.",
    porque:
      "It's instability that's already happening, not a future risk. Each crash loses whatever the application was doing, and users see intermittent errors, the hard-to-report kind.",
    accion:
      "The squad checks why it runs out of memory: it may need more than it has assigned, or it may have a leak that eats it up. Restart loops are almost always a startup error or a dependency that's down.",
  },
  detailNoun: "workloads with early signals (OOM first)",
  headers: {
    senal: "Signal",
    workloads: "Workloads",
    ooms_24h: "OOM kills 24h",
    restarts_24h: "Restarts 24h",
    restarts_num: "Restarts (n)",
    mem_avg_mb: "MEM usage avg (MB)",
    mem_limit_mb: "MEM limit (MB)",
    mem_uso_pct: "Usage vs limit %",
  },
  facets: { senal: "Signal" },
};

export const Preventive = () => (
  <ModulePage
    en={preventiveEn}
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
