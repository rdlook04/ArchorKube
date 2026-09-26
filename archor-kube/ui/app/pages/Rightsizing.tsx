import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { RightsizingProblemChart } from "../components/RightsizingProblemChart";
import { rightsizingReport, rightsizingSummary } from "../queries";
import { assistRightsizingPayload, assistRightsizingPrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { rightsizingPractices } from "../practices/flagged";
import { RowMenu, WORKLOAD_LINK } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const RightsizingRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Rightsizing"
    prompt={assistRightsizingPrompt}
    assistPayload={assistRightsizingPayload}
    practices={rightsizingPractices}
    links={[{ label: WORKLOAD_LINK, href: workloadUrl(row.deployment_id) }]}
  />
);

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

const rightsizingAboutEn = `## 📊 What the report shows

Each row is a **pod** whose sizing (the CPU/memory *requests* and *limits* in its manifest) doesn't match its real usage over the **last 2 hours**. It falls into one of these problems:

* **\`THROTTLING_CRITICO\`** (critical throttling): the CPU *limit* is choking the pod (>25% of the time). It suffers latency even when the node has spare CPU.
* **\`REQUEST_SUBDIMENSIONADO\`** (under-requested): usage is above the *request* (negative slack). The pod asks for less than it uses and is a candidate for eviction or *OOM* under pressure.
* **\`SOBREAPROVISIONADO_CPU_MEM\`** (over-provisioned CPU and memory): far more reserved than used in both (>70% idle in each). The most expensive case.
* **\`SOBREAPROVISIONADO_CPU\` / \`SOBREAPROVISIONADO_MEM\`**: over-provisioned in a single resource (>70% idle).
* **\`REVISAR\`** (to review): between 40% and 70% of the reservation unused. Not urgent, but worth a look at the next review.

*Thresholds: a pod enters the list with slack >40%, throttling >25% or negative slack; it's marked over-provisioned from 70%.*

---

## ⚠️ Why should I care?

An **over-provisioned** pod reserves CPU and memory it never uses: the cluster pays for that capacity and the *scheduler* treats it as taken, so it **blocks nodes** that could host real workloads. An **under-requested or throttled** pod is the opposite problem, cheap but fragile: it performs below expectations and risks failing at peaks.

*Note: the **Waste/month** column values only the idle slack (capacity reserved and not used). The summary totals that spend by problem and tier.*

---

## 🛠️ How do I fix it?

Adjust the *requests* and *limits* in the manifest to bring them close to real usage plus a safety margin:

1. **Over-provisioned:** lower the *requests* to the high percentile of observed usage. It recovers money and frees nodes right away.
2. **Under-requested / throttled:** raise *requests*/*limits* to remove the eviction risk and the *throttling* latency.
3. **Check first:** look at peaks, seasonality and whether an **HPA** already scales on demand, so you don't break autoscaling.

---

> 💡 **Methodology: how was the money (Waste/month) estimated?**
>
> The positive idle *slack* (CPU in millicores and memory in MB reserved and not used) is valued at:
> * **20 USD** per vCPU per month.
> * **4 USD** per GB of RAM per month.
>
> *Based on the prorated cost of an AKS Dv5 node. It's an **order of magnitude to prioritize**, not an exact bill.*`;

const rightsizingEn: ModuleEnglish = {
  title: "Rightsizing (M1/M2 — CPU and memory)",
  about: rightsizingAboutEn,
  simple: {
    que: "Applications that reserved more CPU and memory than they actually use. It's like renting a hall for 100 people and bringing 10: you pay for the whole hall anyway.",
    porque:
      "That reserved capacity is paid for even if nobody uses it, and it's the biggest source of avoidable spend in the cluster. The other way around, the ones that reserved too little show up throttled: they're slow for end users.",
    accion:
      "The owning squad adjusts what its application reserves, bringing it close to what it really uses. Start with tier 1 and with the ones with the most money per month in the waste column.",
  },
  detailNoun: "pods with rightsizing findings (throttling and under-requested first)",
  headers: {
    problema: "Problem",
    pods: "Pods",
    slack_mes_usd: "Waste/month (USD)",
    perdida_mes_usd: "Waste/month (USD)",
    cpu_usage_avg: "CPU usage (mc)",
    cpu_request_avg: "CPU request (mc)",
    cpu_slack_mcores: "CPU slack (mc)",
    cpu_slack_pct: "CPU slack %",
    cpu_throttle_pct: "Throttle % (threshold 25)",
    mem_slack_pct: "MEM slack %",
    mem_slack_mb: "MEM slack (MB)",
  },
};

export const Rightsizing = () => (
  <ModulePage
    en={rightsizingEn}
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
