import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";
import { showToast } from "@dynatrace/strato-components/notifications";

import { dotted, ModulePage } from "../components/ModulePage";
import { RightsizingProblemChart } from "../components/RightsizingProblemChart";
import { rightsizingReport, rightsizingSummary } from "../queries";
import {
  ASSIST_INTENT_OPTIONS,
  assistRightsizingPayload,
  assistRightsizingPrompt,
} from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { rightsizingPractices, useOpenGuide } from "../practices/flagged";

/** Copia el prompt de Assist al portapapeles y avisa con un toast. */
const copyAssistPrompt = (row: Record<string, unknown>) => {
  navigator.clipboard
    .writeText(assistRightsizingPrompt(row))
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
const RightsizingRowMenu = ({ row }: { row: Record<string, unknown> }) => {
  const openGuide = useOpenGuide();
  const flagged = rightsizingPractices(row);
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
        <Menu.Intent payload={assistRightsizingPayload(row)} options={ASSIST_INTENT_OPTIONS}>
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

/** Resalta el problema: rojo = throttling (riesgo), ámbar = subdimensionado. */
const problemaThresholds = [
  {
    comparator: "equal-to" as const,
    value: "THROTTLING_CRITICO",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "REQUEST_SUBDIMENSIONADO",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const rightsizingAbout = `## 📊 Qué muestra el reporte

Cada fila es un **pod** cuyo dimensionamiento (los *requests* y *limits* de CPU/memoria del manifiesto) no coincide con su consumo real en las **últimas 2 horas**. Se clasifica en uno de estos problemas:

* **\`THROTTLING_CRITICO\`:** El *limit* de CPU está estrangulando al pod (>25% del tiempo). Sufre latencia aunque el nodo tenga CPU libre.
* **\`REQUEST_SUBDIMENSIONADO\`:** El uso supera al *request* (slack negativo). El pod pide menos de lo que gasta y es candidato a desalojo u *OOM* bajo presión.
* **\`SOBREAPROVISIONADO_CPU_MEM\`:** Reserva de sobra en CPU **y** memoria (>70% ocioso en ambas). El caso más caro.
* **\`SOBREAPROVISIONADO_CPU\` / \`SOBREAPROVISIONADO_MEM\`:** Reserva de sobra en un solo recurso (>70% ocioso).
* **\`REVISAR\`:** Entre 40% y 70% de la reserva sin usar. No es urgente, pero conviene mirarlo en la próxima revisión.

*Umbrales: un pod entra a la lista con slack >40%, throttling >25% o slack negativo; se marca sobreaprovisionado desde 70%.*

---

## ⚠️ ¿Por qué debería preocuparme?

Un pod **sobre-aprovisionado** reserva CPU y memoria que nunca usa: el clúster factura esa capacidad y, además, el *scheduler* la da por ocupada, así que **bloquea nodos** que podrían alojar cargas reales. Un pod **subdimensionado o con throttling** es el problema opuesto —barato pero frágil—: rinde por debajo de lo esperado y arriesga caídas en los picos.

*Nota: la columna **Desperdicio/mes** valoriza solo el slack ocioso (capacidad reservada y no usada). El resumen totaliza ese gasto por problema y tier.*

---

## 🛠️ ¿Cómo se soluciona?

Ajustar los *requests* y *limits* en el manifiesto para acercarlos al uso real más un margen de seguridad:

1. **Sobre-aprovisionados:** bajar los *requests* al percentil alto del uso observado. Recupera dinero y libera nodos de inmediato.
2. **Subdimensionados / throttling:** subir *requests*/*limits* para eliminar el riesgo de desalojo y la latencia por *throttling*.
3. **Validar antes:** revisar picos, estacionalidad y si hay un **HPA** que ya escale por demanda, para no romper el autoscaling.

---

> 💡 **Metodología: ¿Cómo se estimó el dinero (Desperdicio/mes)?**
>
> Se toma el *slack* ocioso positivo (CPU en millicores y memoria en MB reservados y no usados) y se valoriza con:
> * **20 USD** por vCPU al mes.
> * **4 USD** por GB de RAM al mes.
>
> *Basado en el costo de un nodo AKS Dv5 prorrateado. Es un **orden de magnitud para priorizar**, no una facturación exacta.*`;

export const Rightsizing = () => (
  <ModulePage
    title="Rightsizing (M1/M2 — CPU y Memoria)"
    about={rightsizingAbout}
    summaryQuery={rightsizingSummary}
    summaryColumns={[
      { id: "problema", header: "Problema", accessor: "problema", thresholds: problemaThresholds },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "pods", header: "Pods", accessor: "pods", columnType: "number" },
      { id: "slack_mes_usd", header: "Desperdicio/mes (USD)", accessor: "slack_mes_usd", columnType: "number" },
    ]}
    simple={{
      que: "Aplicaciones que apartaron más CPU y memoria de la que realmente están usando. Es como alquilar un salón para 100 personas y llevar 10: pagas el salón completo igual.",
      porque: "Esa capacidad apartada se paga aunque nadie la use, y es la mayor fuente de gasto evitable del clúster. En sentido contrario, las que apartaron de menos aparecen frenadas: van lentas para el usuario final.",
      accion: "El squad dueño ajusta lo que su aplicación pide reservado, acercándolo a lo que de verdad consume. Empieza por las de tier 1 y por las que más dinero al mes tienen en la columna de desperdicio.",
    }}
    detailQuery={rightsizingReport}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "workload", header: "Workload", accessor: dotted("k8s.workload.name"), minWidth: 200 },
      { id: "pod", header: "Pod", accessor: dotted("k8s.pod.name"), minWidth: 200 },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "problema", header: "Problema", accessor: "problema", thresholds: problemaThresholds, minWidth: 200 },
      {
        id: "perdida_mes_usd",
        header: "Desperdicio/mes (USD)",
        accessor: "perdida_mes_usd",
        columnType: "meterbar",
        disableSorting: false,
        config: { min: 0, max: "data-max", color: Colors.Background.Container.Warning.Accent, showTooltip: true },
        minWidth: 140,
      },
      { id: "cpu_usage_avg", header: "CPU uso (mc)", accessor: "cpu_usage_avg", columnType: "number" },
      { id: "cpu_request_avg", header: "CPU request (mc)", accessor: "cpu_request_avg", columnType: "number" },
      { id: "cpu_slack_mcores", header: "CPU slack (mc)", accessor: "cpu_slack_mcores", columnType: "number" },
      {
        id: "cpu_slack_pct",
        header: "CPU slack %",
        accessor: "cpu_slack_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: { min: 0, max: 100, showTooltip: true },
        minWidth: 120,
      },
      {
        id: "cpu_throttle_pct",
        header: "Throttle % (umbral 25)",
        accessor: "cpu_throttle_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 100,
          showTooltip: true,
          thresholds: [
            { value: 25, color: Colors.Background.Container.Critical.Accent, showIndicator: true },
          ],
        },
        minWidth: 120,
      },
      {
        id: "mem_slack_pct",
        header: "MEM slack %",
        accessor: "mem_slack_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: { min: 0, max: 100, showTooltip: true },
        minWidth: 120,
      },
      { id: "mem_slack_mb", header: "MEM slack (MB)", accessor: "mem_slack_mb", columnType: "number" },
    ]}
    rowActions={(row) => <RightsizingRowMenu row={row} />}
    summaryAside={(filters) => <RightsizingProblemChart filters={filters} />}
    detailFacets={[{ id: "problema", label: "Problema" }]}
    detailNoun="pods con hallazgos de rightsizing (throttling/subdimensionado primero)"
    filterable
  />
);
