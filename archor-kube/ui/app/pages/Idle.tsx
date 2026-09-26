import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";

import { showToast } from "@dynatrace/strato-components/notifications";

import { dotted, ModulePage } from "../components/ModulePage";
import { IdleVerdictChart } from "../components/IdleVerdictChart";
import { idleSummary, idleWorkloads } from "../queries";
import { ASSIST_INTENT_OPTIONS, assistIdlePayload, assistIdlePrompt } from "../queries/assist";
import { serviceUrl, workloadUrl } from "../queries/links";
import { useExternalSend } from "../ai/useExternalSend";

/** Copia el prompt de Assist al portapapeles y avisa con un toast. */
const copyAssistPrompt = (row: Record<string, unknown>) => {
  navigator.clipboard
    .writeText(assistIdlePrompt(row))
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

/**
 * Menú por fila con los deep links a Dynatrace (solo los disponibles).
 * Es un componente y no una función porque el envío a Ollama depende de la
 * preferencia del usuario (placeholders o datos reales), que vive en contexto.
 * Spike del puente (M15): solo en Ociosos hasta validarlo en el tenant.
 */
const IdleRowMenu = ({ row }: { row: Record<string, unknown> }) => {
  const sendToOllama = useExternalSend(assistIdlePrompt, "Idle");
  const serviceLink = serviceUrl(row.service_id);
  const deploymentUrl = workloadUrl(row.deployment_id);
  return (
    <Menu>
      <Menu.Trigger>
        <Button aria-label="Abrir en Dynatrace">
          <DotMenuIcon />
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Intent payload={assistIdlePayload(row)} options={ASSIST_INTENT_OPTIONS}>
          Preguntar a Dynatrace Assist
        </Menu.Intent>
        <Menu.Item onSelect={() => copyAssistPrompt(row)}>
          Copiar prompt para Assist
        </Menu.Item>
        <Menu.Item onSelect={() => sendToOllama(row)}>Send to local Ollama (preview)</Menu.Item>
        <Menu.Link href={serviceLink ?? undefined} target="_blank" disabled={!serviceLink}>
          Abrir servicio (APM)
        </Menu.Link>
        <Menu.Link href={deploymentUrl ?? undefined} target="_blank" disabled={!deploymentUrl}>
          Abrir workload (Kubernetes)
        </Menu.Link>
      </Menu.Content>
    </Menu>
  );
};

/** Resalta el veredicto: verde = ocioso confirmado, rojo = roto (inestable). */
const veredictoThresholds = [
  {
    comparator: "equal-to" as const,
    value: "OCIOSO_CONFIRMADO",
    color: Colors.Text.Success.Default,
    backgroundColor: Colors.Background.Container.Success.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "DESCARTADO_INESTABLE",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];

/** Highlight cells: la celda que causó el descarte se pinta sola. */
const trafficThresholds = [
  {
    comparator: "greater-than" as const,
    value: 10,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];
const restartsThresholds = [
  {
    comparator: "greater-than" as const,
    value: 3,
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];
const oomThresholds = [
  {
    comparator: "greater-than" as const,
    value: 0,
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
];

/**
 * Uso real contra la memoria reservada. Los dos extremos importan por motivos
 * distintos: por encima de la reserva el pod es el primero en caer si el nodo
 * se aprieta; muy por debajo, la reserva es dinero apartado que nadie ocupa.
 */
const usoThresholds = [
  {
    comparator: "equal-to" as const,
    value: "POR_ENCIMA",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "HOLGADO",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const idleAbout = `## 📊 Qué muestra el reporte

Para que un servicio sea considerado como un **ocioso real**, debe cumplir estas tres condiciones sostenidas durante un periodo de 7 días:

1. **Cero tráfico comercial:** ≤ 10 peticiones (*requests*) registradas en el APM.
2. **Cero inestabilidad:** Sin *OOM (Out of Memory) kills* ni bucles de reinicio. Si el servicio se cae constantemente, está roto, no ocioso.
3. **Uso de CPU cercano a 0** de forma sostenida.

Dependiendo de estos factores, a cada servicio se le asigna uno de los siguientes veredictos:

* **\`OCIOSO_CONFIRMADO\`:** Cumple las tres condiciones. Es un candidato ideal y seguro para escalar a cero.
* **\`OCIOSO_SIN_DATO_APM\`:** No tiene tráfico medible en el APM (ej. *jobs* o aplicaciones no-Java), por lo que la inactividad se asume únicamente por la baja CPU.
* **\`DESCARTADO_CON_TRAFICO\`:** Atiende peticiones pero mantiene un uso de CPU bajo. Es un servicio eficiente, no ocioso.
* **\`DESCARTADO_INESTABLE\`:** El pod se reinicia constantemente o muere por falta de memoria.

*Nota: La columna **Motivo** detalla la evidencia específica que justifica el veredicto de cada fila.*

### Bandas de memoria reservada

Cada workload cae en una banda de 200 MB según la memoria que **reserva** (\`requests\`), no la que gasta: 0 – 200 MB, 201 – 400 MB, y así. Es la reserva la que se paga y la que el *scheduler* bloquea en el nodo, aunque el pod nunca la toque.

La columna **Uso vs. reserva** compara el consumo real promedio de 7 días contra esa reserva:

* **\`POR_ENCIMA\`** (más del 100%): gasta más de lo que pidió. Funciona por la memoria que sobra en el nodo, pero es el primer candidato a ser desalojado si el nodo se aprieta.
* **\`AL_LIMITE\`** (85–100%): la reserva está bien calculada, sin margen de sobra.
* **\`AJUSTADO\`** (50–85%): usa la mayor parte de lo que reservó.
* **\`HOLGADO\`** (menos del 50%): más de la mitad de lo reservado nunca se ocupa. Es la banda donde vive el dinero recuperable.
* **\`SIN_RESERVA\`**: el manifiesto no declara *requests* de memoria. No hay contra qué comparar, y además incumple el estándar AKS (ver el módulo de Cumplimiento).

---

## ⚠️ ¿Por qué debería preocuparme?

Estos servicios registran **tráfico comercial nulo** (menos de 10 peticiones a la semana) pero mantienen secuestrados recursos críticos en el clúster (por ejemplo, más de 700 MB de memoria constante por *pod*).

Esto genera un impacto negativo directo:
* **Encarece la infraestructura:** Aumenta la facturación mensual por recursos que no aportan valor al usuario.
* **Bloquea recursos útiles:** Ocupa espacio en los nodos que podría utilizarse para escalar las aplicaciones que sí están bajo carga real.

*Nota: La columna **Pérdida/mes** muestra cuánto dinero cuesta cada servicio individual. El resumen general totaliza este gasto agrupado por veredicto y tier.*

---

## 🛠️ ¿Cómo se soluciona?

La solución consiste en **configurar el escalado a cero** (mediante herramientas como **KEDA** o el **HPA** de Kubernetes). Es un ajuste rápido en los manifiestos que permite que el servicio solo "despierte" cuando exista demanda real.

**Estrategia recomendada:**
1. **Ejecutar primero:** Aplica el escalado a cero inmediatamente en los \`OCIOSO_CONFIRMADO\`, ya que cuentan con evidencia completa de inactividad.
2. **Revisar y validar:** Analiza junto con el *squad* dueño del servicio los casos marcados como \`OCIOSO_SIN_DATO_APM\` antes de actuar, para asegurar que no haya procesos invisibles al APM.

---

> 💡 **Metodología: ¿Cómo se estimó el dinero (Pérdida/mes)?**
>
> El costo se calcula tomando la CPU y memoria reservadas (los *requests* actuales del manifiesto; si no están definidos, se toma el consumo real). Estos recursos se valorizan de la siguiente manera:
> * **20 USD** por vCPU al mes.
> * **4 USD** por GB de RAM al mes.
>
> *Este cálculo está basado en el costo de un nodo AKS Dv5 prorrateado. Su objetivo es dar un **orden de magnitud para priorizar esfuerzos**, no representar una facturación exacta al centavo.*`;

export const Idle = () => (
  <ModulePage
    title="Ociosos (M3 — Regla de Oro del workload ocioso)"
    about={idleAbout}
    summaryQuery={idleSummary}
    summaryColumns={[
      { id: "veredicto", header: "Veredicto", accessor: "veredicto", thresholds: veredictoThresholds },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "workloads", header: "Workloads", accessor: "workloads", columnType: "number" },
      { id: "perdida_mes_usd", header: "Pérdida/mes (USD)", accessor: "perdida_mes_usd", columnType: "number" },
    ]}
    simple={{
      que: "Aplicaciones que llevan una semana entera sin recibir tráfico ni hacer trabajo: están prendidas pero no las usa nadie.",
      porque: "Se paga toda su reserva de CPU y memoria a cambio de nada. Suelen ser pruebas que quedaron corriendo, servicios reemplazados o ambientes olvidados.",
      accion: "El squad dueño confirma si todavía hacen falta. Si no, se apagan o se dejan en cero copias. Si hacen falta pero solo a ratos, se configuran para que arranquen bajo demanda.",
    }}
    detailQuery={idleWorkloads}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      { id: "workload", header: "Workload", accessor: dotted("k8s.workload.name"), minWidth: 200 },
      { id: "tier", header: "Tier", accessor: "tier" },
      { id: "squad", header: "Squad", accessor: "squad" },
      { id: "veredicto", header: "Veredicto", accessor: "veredicto", thresholds: veredictoThresholds },
      { id: "motivo", header: "Motivo (evidencia)", accessor: "motivo", minWidth: 280, width: "2fr" },
      {
        id: "perdida_mes_usd",
        header: "Pérdida/mes (USD)",
        accessor: "perdida_mes_usd",
        columnType: "meterbar",
        // meterbar desactiva el sort por defecto; lo reactivamos (ordena por el valor).
        disableSorting: false,
        config: {
          min: 0,
          max: "data-max",
          color: Colors.Background.Container.Warning.Accent,
          showTooltip: true,
        },
        minWidth: 140,
      },
      {
        id: "req_total",
        header: "Requests 7d",
        accessor: "req_total",
        columnType: "number",
        thresholds: trafficThresholds,
      },
      { id: "req_cpu_mc", header: "CPU reservada (mc)", accessor: "req_cpu_mc", columnType: "number" },
      { id: "req_mem_mb", header: "MEM reservada (MB)", accessor: "req_mem_mb", columnType: "number" },
      { id: "rango_mem", header: "Rango MEM reservada", accessor: "rango_mem", minWidth: 160 },
      {
        id: "cpu_avg",
        header: "CPU avg (mc, umbral 5)",
        accessor: "cpu_avg",
        columnType: "meterbar",
        disableSorting: false,
        config: { min: 0, max: 5, showTooltip: true },
        minWidth: 120,
      },
      {
        id: "cpu_max",
        header: "CPU max (mc, umbral 20)",
        accessor: "cpu_max",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 20,
          showTooltip: true,
          thresholds: [
            {
              value: 1,
              color: Colors.Background.Container.Critical.Accent,
              showIndicator: true,
            },
          ],
        },
        minWidth: 120,
      },
      { id: "mem_avg_mb", header: "MEM avg (MB)", accessor: "mem_avg_mb", columnType: "number" },
      {
        id: "mem_uso_pct",
        header: "Uso vs. reserva (%)",
        accessor: "mem_uso_pct",
        columnType: "meterbar",
        disableSorting: false,
        config: {
          min: 0,
          max: 100,
          showTooltip: true,
          // La marca en 85 separa "le queda holgura" de "está al límite";
          // por encima de 100 la barra se llena: usa más de lo que reservó.
          thresholds: [
            {
              value: 85,
              color: Colors.Background.Container.Warning.Accent,
              showIndicator: true,
            },
          ],
        },
        minWidth: 140,
      },
      {
        id: "uso_vs_reserva",
        header: "Uso vs. reserva",
        accessor: "uso_vs_reserva",
        thresholds: usoThresholds,
        minWidth: 140,
      },
      {
        id: "restarts_7d",
        header: "Restarts 7d",
        accessor: "restarts_7d",
        columnType: "number",
        thresholds: restartsThresholds,
      },
      {
        id: "ooms_7d",
        header: "OOM 7d",
        accessor: "ooms_7d",
        columnType: "number",
        thresholds: oomThresholds,
      },
    ]}
    rowActions={(row) => <IdleRowMenu row={row} />}
    summaryAside={(filters) => <IdleVerdictChart filters={filters} />}
    detailFacets={[
      { id: "veredicto", label: "Veredicto" },
      { id: "motivo", label: "Motivo" },
      { id: "rango_mem", label: "Rango MEM reservada", numeric: true },
      { id: "uso_vs_reserva", label: "Uso vs. reserva" },
    ]}
    detailNoun="candidatos evaluados por la Regla de Oro (confirmados primero)"
    filterable
  />
);
