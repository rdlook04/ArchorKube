import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";
import { showToast } from "@dynatrace/strato-components/notifications";

import { dotted, ModulePage } from "../components/ModulePage";
import { ComplianceChart } from "../components/ComplianceChart";
import { complianceReport, complianceSummary } from "../queries";
import {
  ASSIST_INTENT_OPTIONS,
  assistCompliancePayload,
  assistCompliancePrompt,
} from "../queries/assist";
import { workloadUrl } from "../queries/links";

/** Copia el prompt de Assist al portapapeles y avisa con un toast. */
const copyAssistPrompt = (row: Record<string, unknown>) => {
  navigator.clipboard
    .writeText(assistCompliancePrompt(row))
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

/** Menú por fila: preguntar a Assist, copiar prompt y abrir el workload. */
const complianceRowActions = (row: Record<string, unknown>) => {
  const deploymentUrl = workloadUrl(row.deployment_id);
  return (
    <Menu>
      <Menu.Trigger>
        <Button aria-label="Abrir en Dynatrace">
          <DotMenuIcon />
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Intent payload={assistCompliancePayload(row)} options={ASSIST_INTENT_OPTIONS}>
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

/** Resalta la criticidad: rojo = riesgo de disponibilidad, verde = cumple todo. */
const criticidadThresholds = [
  {
    comparator: "equal-to" as const,
    value: "RIESGO_DISPONIBILIDAD",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "RIESGO_RECURSOS",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "CUMPLE_TODO",
    color: Colors.Text.Success.Default,
    backgroundColor: Colors.Background.Container.Success.Emphasized,
  },
];

/** Pinta de rojo cada celda de spec que NO cumple. */
const specThresholds = [
  {
    comparator: "equal-to" as const,
    value: "❌ No cumple",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "❌ Sin Helm",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];

/** Estado semafórico del dashboard por spec. */
const estadoThresholds = [
  {
    comparator: "equal-to" as const,
    value: "🔴 Crítico",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "✅ OK",
    color: Colors.Text.Success.Default,
    backgroundColor: Colors.Background.Container.Success.Emphasized,
  },
];

const complianceAbout = `## 📊 Qué muestra el reporte

El **cumplimiento del estándar AKS** de cada workload frente a **8 especificaciones** de buenas prácticas de despliegue. Se leen los manifiestos reales desde Smartscape (\`K8S_POD\`), se evalúa contenedor por contenedor y se agrega por workload:

| Spec | Qué exige |
|:---|:---|
| **SPEC01** | \`limits.cpu\` definido |
| **SPEC02** | \`limits.memory\` definido |
| **SPEC03** | \`requests.cpu\` definido |
| **SPEC04** | \`requests.memory\` definido |
| **SPEC05** | *Liveness probe* configurada |
| **SPEC06** | *Readiness probe* configurada |
| **SPEC07** | Contenedor **no-root** (\`runAsNonRoot\`) |
| **SPEC08** | Desplegado por **Helm** (etiqueta \`app.kubernetes.io/managed-by = Helm\`) |

La columna **% Cumplimiento** es cuántas de las 8 specs cumple el workload. La **Criticidad** resume el peor incumplimiento según su impacto en disponibilidad.

---

## ⚠️ ¿Por qué debería preocuparme? (nivel de riesgo por spec)

| Spec | Riesgo | Impacto en disponibilidad |
|:---|:---:|:---|
| **SPEC06** Readiness Probe | 🔴 Crítico | Tráfico enrutado a pods no listos o en terminación → 5xx/timeouts en despliegues |
| **SPEC05** Liveness Probe | 🔴 Crítico | Contenedores colgados no se reinician solos → indisponibilidad silenciosa |
| **SPEC02** Memory Limit | 🟠 Alto | Sin límite → OOMKill de pods vecinos (*noisy neighbor*) |
| **SPEC04** Memory Request | 🟠 Alto | Mal *scheduling* → sobreasignación de memoria del nodo |
| **SPEC01** CPU Limit | 🟡 Medio | *Throttling*/*starvation* de vecinos → degradación de latencia |
| **SPEC03** CPU Request | 🟡 Medio | *Scheduling* subóptimo, no causa caída dura |
| **SPEC07** Non-Root | ⚪ Seguridad | *Hardening* (superficie de ataque, escalación) — no afecta disponibilidad |
| **SPEC08** Helm | ⚪ Trazabilidad | Sin Helm el despliegue se hizo a mano o viene de la infraestructura anterior: no es reproducible ni auditable |

**Leyenda:** 🔴 causa directa de caída · 🟠 causa indirecta fuerte · 🟡 degradación, no caída dura · ⚪ gate de seguridad.

La **Criticidad** de cada fila ordena esta cola: \`RIESGO_DISPONIBILIDAD\` (falla probe) → \`RIESGO_RECURSOS\` (falta mem limit/request) → \`AJUSTE_MENOR\` (falta cpu limit/request) → \`SOLO_SEGURIDAD\` (solo non-root) → \`SIN_HELM\` (solo falta trazabilidad) → \`CUMPLE_TODO\`.

---

## 🛠️ ¿Cómo se soluciona?

**Prioridad de remediación:** \`SPEC06 → SPEC05 → SPEC02/04 → SPEC01/03 → SPEC07 → SPEC08\`.

1. **Primero las probes** (SPEC06/05): son las que causan caídas. Añade *readiness* y *liveness* con endpoints y umbrales realistas.
2. **Luego memoria** (SPEC02/04): define \`requests\` y \`limits\` de memoria para frenar OOM de vecinos y mejorar el *scheduling*.
3. **Después CPU** (SPEC01/03) y por último el *hardening* non-root (SPEC07).

*Nota: módulo de gobernanza técnica; no tiene pérdida en USD. El dashboard general (arriba) muestra qué spec incumple más el clúster; el detalle (abajo) lista los workloads a remediar ordenados por criticidad.*`;

export const Compliance = () => (
  <ModulePage
    title="Cumplimiento (M12 — Estándar AKS, 8 SPECs)"
    about={complianceAbout}
    summaryQuery={complianceSummary}
    summaryColumns={[
      { id: "spec", header: "Especificación", accessor: "spec", minWidth: 200 },
      { id: "cumple", header: "✅ Cumplen", accessor: "cumple", columnType: "number" },
      { id: "no_cumple", header: "❌ No cumplen", accessor: "no_cumple", columnType: "number" },
      {
        id: "incumplimiento_pct",
        header: "% Incumplimiento",
        accessor: "incumplimiento_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 100,
          color: Colors.Background.Container.Critical.Accent,
          showTooltip: true,
        },
        minWidth: 140,
      },
      { id: "estado", header: "Estado", accessor: "estado", thresholds: estadoThresholds },
    ]}
    simple={{
      que: "Qué tanto cumple cada aplicación con las ocho reglas mínimas que la organización definió para desplegar en Kubernetes: declarar cuánto necesita, ponerse un tope, tener chequeos de salud, no correr con permisos de administrador y haberse desplegado con Helm.",
      porque: "Estas reglas son las que evitan la mayoría de los problemas que ves en los demás módulos. Una aplicación que las cumple raramente aparece en riesgo de caída, en desperdicio o en frenado. Además, correr con permisos de administrador es un riesgo de seguridad.",
      accion: "El squad completa lo que le falta a su aplicación. Cada regla incumplida es un cambio de configuración, no de código. Empieza por las marcadas como críticas de tier 1.",
    }}
    detailQuery={complianceReport}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "workload", header: "Workload", accessor: dotted("k8s.workload.name"), minWidth: 200 },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      {
        id: "criticidad",
        header: "Criticidad",
        accessor: "criticidad",
        thresholds: criticidadThresholds,
        minWidth: 180,
      },
      {
        id: "cumplimiento_pct",
        header: "% Cumplimiento",
        accessor: "cumplimiento_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 100,
          color: Colors.Background.Container.Success.Accent,
          showTooltip: true,
          thresholds: [
            { value: 100, color: Colors.Background.Container.Success.Accent, showIndicator: true },
          ],
        },
        minWidth: 140,
      },
      { id: "spec06", header: "SPEC06 Readiness 🔴", accessor: "spec06", thresholds: specThresholds },
      { id: "spec05", header: "SPEC05 Liveness 🔴", accessor: "spec05", thresholds: specThresholds },
      { id: "spec02", header: "SPEC02 Mem Limit 🟠", accessor: "spec02", thresholds: specThresholds },
      { id: "spec04", header: "SPEC04 Mem Request 🟠", accessor: "spec04", thresholds: specThresholds },
      { id: "spec01", header: "SPEC01 CPU Limit 🟡", accessor: "spec01", thresholds: specThresholds },
      { id: "spec03", header: "SPEC03 CPU Request 🟡", accessor: "spec03", thresholds: specThresholds },
      { id: "spec07", header: "SPEC07 Non-Root ⚪", accessor: "spec07", thresholds: specThresholds },
      { id: "spec08", header: "SPEC08 Helm ⚪", accessor: "spec08", thresholds: specThresholds },
    ]}
    rowActions={complianceRowActions}
    summaryAside={(filters) => <ComplianceChart filters={filters} />}
    detailFacets={[{ id: "criticidad", label: "Criticidad" }]}
    detailNoun="workloads evaluados (peor criticidad primero)"
    filterable
  />
);
