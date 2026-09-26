import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { dotted, ModulePage } from "../components/ModulePage";
import { ElasticityChart } from "../components/ElasticityChart";
import { hpaElasticity, hpaElasticitySummary } from "../queries";
import { assistElasticityPayload, assistElasticityPrompt } from "../queries/assist";
import { workloadUrl } from "../queries/links";
import { elasticityPractices } from "../practices/flagged";
import { RowMenu } from "../components/RowMenu";

/** Menú por fila: el compartido de todos los módulos (ver components/RowMenu). */
const ElasticityRowMenu = ({ row }: { row: Record<string, unknown> }) => (
  <RowMenu
    row={row}
    module="Elasticity"
    prompt={assistElasticityPrompt}
    assistPayload={assistElasticityPayload}
    practices={elasticityPractices}
    links={[{ label: "Abrir workload (Kubernetes)", href: workloadUrl(row.deployment_id) }]}
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

export const Elasticity = () => (
  <ModulePage
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
