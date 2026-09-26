import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage, type ModuleEnglish } from "../components/ModulePage";
import { ElasticityChart } from "../components/ElasticityChart";
import { hpaElasticity, hpaElasticitySummary } from "../queries";
import { assistElasticityPayload, assistElasticityPrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { elasticityPractices } from "../practices/flagged";
import { RowMenu, WORKLOAD_LINK } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const ElasticityRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Elasticity"
    prompt={assistElasticityPrompt}
    assistPayload={assistElasticityPayload}
    practices={elasticityPractices}
    links={[{ label: WORKLOAD_LINK, href: workloadUrl(row.deployment_id) }]}
  />
);

/** Resalta la elasticidad: rojo = bloqueado, ámbar = sin margen. */
const elasticidadThresholds = [
  {
    comparator: "equal-to" as const,
    value: "BLOQUEADO_NECESITA_MAX",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "SIN_MARGEN_MIN_ES_MAX",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const elasticityAbout = `## 📊 Qué muestra el reporte

El estado de los **HorizontalPodAutoscalers (HPA)** del clúster —el mecanismo que ajusta las réplicas de un workload según la carga—. Cada fila es un HPA clasificado en:

* **\`BLOQUEADO_NECESITA_MAX\`:** el HPA **quiere más réplicas de las que permite su \`maxReplicas\`** (condición *TooManyReplicas*). Está topado: no puede absorber más carga aunque la haya.
* **\`SIN_MARGEN_MIN_ES_MAX\`:** \`minReplicas == maxReplicas\`. El HPA existe pero **no escala nada** —la elasticidad está anulada—.
* **\`OK\`:** tiene margen para escalar.

*Los HPA se enlazan al catálogo de propiedad por nombre para asignar tier/squad.*

---

## ⚠️ ¿Por qué debería preocuparme?

Un HPA **bloqueado** es un servicio que, bajo un pico de tráfico, **no escalará** y empezará a degradarse o caerse justo cuando más se le necesita. Un HPA **sin margen** da una falsa sensación de elasticidad: parece autoscalado pero corre con réplicas fijas. En tiers de negocio, ambos casos son riesgo de disponibilidad directo.

---

## 🛠️ ¿Cómo se soluciona?

1. **\`BLOQUEADO_NECESITA_MAX\`:** **subir \`maxReplicas\`** (validando que los nodos tengan capacidad) para darle techo real al autoscaling.
2. **\`SIN_MARGEN_MIN_ES_MAX\`:** separar \`min\` y \`max\` para habilitar la elasticidad, salvo que el tope fijo sea intencional.
3. **Validar antes:** la métrica objetivo del HPA (CPU/memoria/custom) y la capacidad del *pool* de nodos para sostener el nuevo máximo.

> 💡 Usa **Preguntar a Dynatrace Assist** en cada fila para un ajuste recomendado con la evidencia ya cargada.

*Nota: módulo de disponibilidad/resiliencia; el impacto es riesgo de caída, no un costo mensual, por eso no muestra USD.*`;

const elasticityAboutEn = `## 📊 What the report shows

The state of the cluster's **HorizontalPodAutoscalers (HPA)**, the mechanism that adjusts a workload's replicas to the load. Each row is an HPA classified as:

* **\`BLOQUEADO_NECESITA_MAX\`** (blocked, needs a higher max): the HPA **wants more replicas than its \`maxReplicas\` allows** (condition *TooManyReplicas*). It's capped: it can't absorb more load even when there is some.
* **\`SIN_MARGEN_MIN_ES_MAX\`** (no headroom, min equals max): \`minReplicas == maxReplicas\`. The HPA exists but **doesn't scale at all**: elasticity is switched off.
* **\`OK\`:** it has room to scale.

*HPAs are linked to the ownership catalog by name to assign tier/squad.*

---

## ⚠️ Why should I care?

A **blocked** HPA is a service that, under a traffic peak, **won't scale** and will start to degrade or go down exactly when it's needed most. An HPA **without headroom** gives a false sense of elasticity: it looks autoscaled but runs with fixed replicas. In business tiers, both cases are a direct availability risk.

---

## 🛠️ How do I fix it?

1. **\`BLOQUEADO_NECESITA_MAX\`:** **raise \`maxReplicas\`** (checking the nodes have capacity) to give autoscaling a real ceiling.
2. **\`SIN_MARGEN_MIN_ES_MAX\`:** separate \`min\` and \`max\` to enable elasticity, unless the fixed cap is intentional.
3. **Check first:** the HPA's target metric (CPU/memory/custom) and the node *pool* capacity to sustain the new maximum.

> 💡 Use **Ask Dynatrace Assist** on each row for a recommended adjustment with the evidence already loaded.

*Note: availability/resilience module; the impact is outage risk, not a monthly cost, so it shows no USD.*`;

const elasticityEn: ModuleEnglish = {
  title: "HPA elasticity (M5 — Outage risk)",
  about: elasticityAboutEn,
  simple: {
    que: "Applications set up to grow on their own when load rises, but that already hit their maximum or have no room to grow.",
    porque:
      "If a traffic peak arrives, those applications can't add more copies: they hold what they can and the rest of the users wait or get errors. The automatic growth mechanism is there, but capped.",
    accion:
      "The squad raises the maximum number of copies allowed, or separates the minimum from the maximum so it has room to maneuver. Prioritize the tier 1 ones marked as blocked.",
  },
  detailNoun: "HPAs evaluated (blocked first)",
  headers: {
    elasticidad: "Elasticity",
    hpas: "HPAs",
    hpa_name: "HPA",
    hpa_min: "Min",
    hpa_max: "Max",
    hpa_current: "Current",
    hpa_desired: "Desired",
    appCode: "Application",
  },
  facets: { elasticidad: "Elasticity" },
};

export const Elasticity = () => (
  <ModulePage
    en={elasticityEn}
    title="Elasticidad HPA (M5 — Riesgo de caída)"
    about={elasticityAbout}
    summaryQuery={hpaElasticitySummary}
    summaryColumns={[
      { id: "elasticidad", header: "Elasticidad", accessor: "elasticidad", thresholds: elasticidadThresholds },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "hpas", header: "HPAs", accessor: "hpas", columnType: "number" },
    ]}
    simple={{
      que: "Aplicaciones configuradas para crecer solas cuando sube la carga, pero que ya llegaron a su máximo o no tienen margen para crecer.",
      porque: "Si llega un pico de tráfico, esas aplicaciones no pueden agregar más copias: aguantan lo que puedan y el resto de usuarios espera o recibe errores. El mecanismo de crecimiento automático está ahí, pero topado.",
      accion: "El squad sube el máximo de copias permitido, o separa mejor el mínimo del máximo para que tenga espacio de maniobra. Prioriza las de tier 1 marcadas como bloqueadas.",
    }}
    detailQuery={hpaElasticity}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "hpa_name", header: "HPA", accessor: "hpa_name", minWidth: 220 },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "elasticidad", header: "Elasticidad", accessor: "elasticidad", thresholds: elasticidadThresholds, minWidth: 200 },
      { id: "hpa_min", header: "Min", accessor: "hpa_min", columnType: "number" },
      { id: "hpa_max", header: "Max", accessor: "hpa_max", columnType: "number" },
      { id: "hpa_current", header: "Actuales", accessor: "hpa_current", columnType: "number" },
      { id: "hpa_desired", header: "Deseadas", accessor: "hpa_desired", columnType: "number" },
      { id: "appCode", header: "Aplicación", accessor: "appCode" },
    ]}
    rowActions={(row) => <ElasticityRowMenu row={row} />}
    summaryAside={(filters) => <ElasticityChart filters={filters} />}
    detailFacets={[{ id: "elasticidad", label: "Elasticidad" }]}
    detailNoun="HPAs evaluados (bloqueados primero)"
    filterable
  />
);
