import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage } from "../components/ModulePage";
import { ErrorSeverityChart } from "../components/ErrorSeverityChart";
import { criticalErrors, criticalErrorsSummary } from "../queries";
import { assistErrorPayload, assistErrorPrompt } from "../queries/assist";
import { RowMenu } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const ErrorsRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Errors"
    prompt={assistErrorPrompt}
    assistPayload={assistErrorPayload}
  />
);

/** Resalta la severidad: rojo = con críticos, ámbar = solo errores. */
const severidadThresholds = [
  {
    comparator: "equal-to" as const,
    value: "CON_CRITICOS",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "SOLO_ERRORES",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

/** Celda: cualquier crítico se pinta. */
const criticosThresholds = [
  {
    comparator: "greater-than" as const,
    value: 0,
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];

const errorsAbout = `## 📊 Qué muestra el reporte

Los **300 contenedores más ruidosos** por logs de error en las **últimas 24 horas**. Cada fila cuenta:

* **Errores:** líneas con nivel \`ERROR\`, \`CRITICAL\`, \`EMERGENCY\`, \`SEVERE\` o \`FATAL\`.
* **Críticos:** el subconjunto peor que \`ERROR\` (fallas graves que casi siempre exigen intervención).

Según eso se marca la **severidad**: **\`CON_CRITICOS\`** (tiene al menos un crítico) o **\`SOLO_ERRORES\`**.

*En este environment los logs no traen \`k8s.workload.name\`, así que se agrupa por \`k8s.container.name\` —que además hace match con el catálogo de propiedad para asignar tier/squad.*

---

## ⚠️ ¿Por qué debería preocuparme?

Un volumen alto de errores es **deuda de observabilidad y riesgo latente**: esconde fallas reales entre ruido, satura el almacenamiento de logs y suele preceder incidentes. Los \`CON_CRITICOS\` de tiers de negocio son los que hay que mirar primero.

---

## 🛠️ ¿Cómo se soluciona?

1. **Priorizar \`CON_CRITICOS\` por tier:** empezar por los servicios críticos con fallas graves.
2. **Clasificar el ruido:** separar errores esperables (reintentos, 4xx de clientes) de fallas reales (excepciones, timeouts, 5xx, dependencias caídas) y silenciar/arreglar según corresponda.
3. **Atacar la causa raíz:** usar Assist para leer los patrones de log del contenedor y decidir el siguiente paso.

> 💡 Usa **Preguntar a Dynatrace Assist** en cada fila para investigar los logs del contenedor con el contexto ya cargado.

*Nota: módulo de calidad/observabilidad, no de consumo; no muestra pérdida en USD.*`;

export const Errors = () => (
  <ModulePage
    title="Errores críticos (M9 — Logs 24h)"
    about={errorsAbout}
    summaryQuery={criticalErrorsSummary}
    summaryColumns={[
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "contenedores", header: "Contenedores", accessor: "contenedores", columnType: "number" },
      { id: "errores_total", header: "Errores", accessor: "errores_total", columnType: "number" },
      { id: "criticos_total", header: "Críticos", accessor: "criticos_total", columnType: "number" },
    ]}
    simple={{
      que: "Las aplicaciones que más mensajes de error están escribiendo en sus registros durante el último día.",
      porque: "Un volumen alto de errores suele anticipar una falla visible para el usuario. Los marcados como críticos o fatales ya son fallas reales, no ruido.",
      accion: "El squad dueño revisa primero los que tienen críticos. Ojo: mucho volumen no siempre es grave — algunas aplicaciones registran errores esperados y hacen ruido. Lo que importa es la columna de críticos.",
    }}
    detailQuery={criticalErrors}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "container", header: "Contenedor", accessor: dotted("k8s.container.name"), minWidth: 240 },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "severidad", header: "Severidad", accessor: "severidad", thresholds: severidadThresholds, minWidth: 150 },
      {
        id: "errores",
        header: "Errores 24h",
        // Grail serializa el entero de count() como string; la meterbar necesita número.
        accessor: (row: Record<string, unknown>) => Number(row.errores ?? 0),
        columnType: "meterbar",
        disableSorting: false,
        config: { min: 0, max: "data-max", color: Colors.Background.Container.Warning.Accent, showTooltip: true },
        minWidth: 160,
      },
      {
        id: "criticos",
        header: "Críticos 24h",
        accessor: "criticos",
        columnType: "number",
        thresholds: criticosThresholds,
      },
    ]}
    rowActions={(row) => <ErrorsRowMenu row={row} />}
    summaryAside={(filters) => <ErrorSeverityChart filters={filters} />}
    detailFacets={[{ id: "severidad", label: "Severidad" }]}
    detailNoun="contenedores con errores (con críticos primero)"
    filterable
  />
);
