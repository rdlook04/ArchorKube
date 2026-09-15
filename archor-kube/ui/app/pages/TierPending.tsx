import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { ModulePage, dotted } from "../components/ModulePage";
import { tierPendingBySquad, tierPendingWorkloads } from "../queries/tierPending";

/**
 * Resalta el caso que NO se puede repartir: sin dueño no hay a quién pedirle
 * el tier, así que es un bloqueo, no una tarea.
 */
const motivoThresholds = [
  {
    comparator: "equal-to" as const,
    value: "FALTA_DUENO",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "ASIGNAR_TIER",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const pendingAbout = `## 📊 Qué muestra el reporte

Los workloads que corren **sin tier declarado**, y a qué squad hay que reclamárselo.

No es un hallazgo técnico: es la deuda que impide priorizar todo lo demás. Un workload sin tier queda al fondo de la cola de cada módulo —no porque esté sano, sino porque nadie declaró cuánto importa.

Se separan en dos casos, porque la acción y el responsable son distintos:

* **\`ASIGNAR_TIER\`:** el squad ya se conoce. **Es repartible hoy mismo**: ese equipo declara el tier y listo.
* **\`FALTA_DUENO\`:** no hay ni squad. **No se puede repartir**: primero hay que averiguar de quién es (ver M6 Huérfanos) y recién después pedir el tier.

---

## ⚠️ ¿Por qué debería preocuparme?

Porque el tier es lo que convierte una lista de hallazgos en una **cola priorizada por impacto de negocio**, y es información que solo el squad puede dar: nadie desde plataforma sabe si un servicio aguanta media hora caído o ninguna.

Mientras el tier falte, ese workload es invisible para la priorización. Y el sesgo es malo: cuando aparecen los datos, la mayoría de lo que estaba sin tier resulta ser **tier 1**.

---

## 🛠️ ¿Cómo se usa?

1. **Filtrar por squad** con los selectores de arriba y mandarle a cada equipo su lista.
2. **Atacar primero los \`ASIGNAR_TIER\`:** son los que se cierran con una decisión, sin investigación previa.
3. **Los \`FALTA_DUENO\` van a M6 Huérfanos:** ahí se resuelve el dueño; el tier viene después.
4. **Cerrar el hueco en la fuente:** dando de alta el tier en el catálogo, o poniendo la label de tier en el manifiesto.

*Nota: módulo de gobernanza, no de consumo; no tiene pérdida en USD ni barras de uso.*`;

export const TierPending = () => (
  <ModulePage
    title="Pendientes de tieraje (M7 — Sin tier declarado)"
    about={pendingAbout}
    summaryQuery={tierPendingBySquad}
    summaryColumns={[
      { id: "squad", header: "Squad", accessor: "squad", minWidth: 220 },
      { id: "tribu", header: "Tribu", accessor: "tribu", minWidth: 180 },
      {
        id: "pendientes",
        header: "Pendientes",
        accessor: (row: Record<string, unknown>) => Number(row.pendientes),
        columnType: "number",
      },
      {
        id: "sin_dueno",
        header: "De esos, sin dueño",
        accessor: (row: Record<string, unknown>) => Number(row.sin_dueno),
        columnType: "number",
      },
    ]}
    simple={{
      que: "Aplicaciones corriendo que nadie clasificó por importancia para el negocio, y el equipo al que hay que preguntarle.",
      porque: "Sin esa clasificación no se puede decir qué se arregla primero. Una aplicación sin tier se trata como si diera igual que se caiga, y muchas veces es justo al revés: al clasificarlas, la mayoría resulta ser de las más críticas.",
      accion: "Repartir la lista por equipo. Los que ya tienen dueño se cierran con una decisión del equipo; los que no tienen dueño hay que identificarlos primero en Huérfanos.",
    }}
    detailQuery={tierPendingWorkloads}
    detailColumns={[
      { id: "cluster", header: "Cluster", accessor: dotted("k8s.cluster.name") },
      { id: "namespace", header: "Namespace", accessor: dotted("k8s.namespace.name") },
      {
        id: "workload",
        header: "Workload",
        accessor: dotted("k8s.workload.name"),
        minWidth: 240,
      },
      { id: "kind", header: "Kind", accessor: dotted("k8s.workload.kind") },
      { id: "squad", header: "Squad", accessor: "squad", minWidth: 180 },
      { id: "tribu", header: "Tribu", accessor: "tribu" },
      {
        id: "motivo",
        header: "Motivo",
        accessor: "motivo",
        thresholds: motivoThresholds,
        minWidth: 160,
      },
    ]}
    detailFacets={[{ id: "motivo", label: "Motivo" }]}
    detailNoun="workloads sin tier (repartibles primero)"
    filterable
  />
);
