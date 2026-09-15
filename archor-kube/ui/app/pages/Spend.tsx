import React from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";

import { ModulePage, dotted } from "../components/ModulePage";
import { NodeTrendChart } from "../components/NodeTrendChart";
import { nodeInventory, spendByInstanceType } from "../queries/spend";
import { INSTANCE_HOURLY_USD, PRICING_SOURCE } from "../config/site";

/**
 * Los precios configurados, en texto, para que la explicación diga siempre lo
 * que el cálculo usa de verdad y no una tabla que quedó vieja en un comentario.
 */
const priceList =
  Object.entries(INSTANCE_HOURLY_USD)
    .map(([sku, usd]) => `\`${sku}\` ${usd.toFixed(4)} USD/h`)
    .join(" y ") || "sin tipos de instancia configurados";

/** Resalta los nodos recién creados: son los que mueven el gasto. */

const antiguedadThresholds = [
  {
    comparator: "equal-to" as const,
    value: "NUEVO",
    color: Colors.Text.Critical.Default,
    backgroundColor: Colors.Background.Container.Critical.Emphasized,
  },
  {
    comparator: "equal-to" as const,
    value: "RECIENTE",
    color: Colors.Text.Warning.Default,
    backgroundColor: Colors.Background.Container.Warning.Emphasized,
  },
];

const spendAbout = `## 📊 Qué muestra el reporte

El **inventario de máquinas** que sostiene los clústeres, que es de donde sale la factura de infraestructura. Cada nodo se enriquece con su **tipo de instancia** (etiqueta \`beta.kubernetes.io/instance-type\`) y con cuántos **días estuvo activo** en los últimos 30.

| Columna | Qué significa |
|:---|:---|
| **Nodos** | Máquinas distintas vistas en la ventana, existan todavía o no |
| **Activos hoy** | Las que seguían reportando en el último intervalo |
| **Días promedio** | Cuánto duran en promedio: valores bajos indican mucha rotación del autoscaler |
| **Nodo-días** | Suma de días de todas las máquinas del grupo. Es la base del prorrateo |
| **Gasto 30 días** | Nodo-días × 24 h × precio por hora del tipo de instancia |
| **Ritmo actual** | Lo que costarían al mes las máquinas que siguen encendidas |

---

## ⚠️ ¿Por qué debería preocuparme?

Los demás módulos estiman **desperdicio**; este mide **el gasto**. Sin él, decir "se desperdician 5.000 USD al mes" no tiene escala: no se sabe si es el 5% o el 60% de lo que se paga.

La nube factura las máquinas **por hora, no por mes**. Por eso el conteo de nodos no basta: un nodo que vivió 3 días cuesta 3/30 del precio mensual. La columna **nodo-días** es lo que permite prorratear, y sin ella un clúster con autoscaler agresivo parecería gastar mucho más de lo que factura.

---

## 🛠️ ¿Cómo se usa?

1. **Dimensionar:** nodos × precio del tipo de instancia = gasto del clúster.
2. **Ver la tendencia:** la gráfica muestra si el número de máquinas crece. Un escalón hacia arriba que no baja es gasto nuevo permanente.
3. **Detectar rotación:** muchos nodos con pocos días de vida significan que el autoscaler está creando y destruyendo constantemente.

**Precios:** ${PRICING_SOURCE}: ${priceList}. Con reserved instances o acuerdos empresariales el costo real puede ser 20-40 % menor, así que estas cifras son un techo. Un tipo de instancia sin precio en la tabla aparece sin gasto, no en cero.`;

export const Spend = () => (
  <ModulePage
    title="Gasto (M13 — Infraestructura)"
    about={spendAbout}
    simple={{
      que: "Cuántas máquinas sostienen los clústeres, de qué tamaño son y cuánto tiempo llevan encendidas.",
      porque:
        "Es la factura de infraestructura. Los demás módulos dicen cuánto se desperdicia; este dice sobre cuánto. Sin esa referencia, un ahorro de mil dólares al mes puede ser mucho o insignificante.",
      accion:
        "Vigilar la tendencia: si el número de máquinas sube y no vuelve a bajar, el gasto subió de forma permanente y conviene entender qué lo provocó.",
    }}
    summaryQuery={spendByInstanceType}
    summaryColumns={[
      { id: "cluster", header: "Clúster", accessor: dotted("k8s.cluster.name"), minWidth: 160 },
      { id: "instance_type", header: "Tipo de instancia", accessor: "instance_type", minWidth: 170 },
      { id: "nodos", header: "Nodos", accessor: "nodos", columnType: "number" },
      { id: "activos_hoy", header: "Activos hoy", accessor: "activos_hoy", columnType: "number" },
      { id: "dias_promedio", header: "Días promedio", accessor: "dias_promedio", columnType: "number" },
      { id: "nodo_dias", header: "Nodo-días", accessor: "nodo_dias", columnType: "number" },
      { id: "precio_mes_usd", header: "USD/mes por nodo", accessor: "precio_mes_usd", columnType: "number" },
      { id: "gasto_30d_usd", header: "Gasto 30 días (USD)", accessor: "gasto_30d_usd", columnType: "number" },
      { id: "ritmo_mes_usd", header: "Ritmo actual (USD/mes)", accessor: "ritmo_mes_usd", columnType: "number" },
    ]}
    detailQuery={nodeInventory}
    detailColumns={[
      { id: "cluster", header: "Clúster", accessor: dotted("k8s.cluster.name"), minWidth: 160 },
      { id: "nodo", header: "Nodo", accessor: dotted("k8s.node.name"), minWidth: 280 },
      { id: "instance_type", header: "Tipo de instancia", accessor: "instance_type", minWidth: 170 },
      {
        id: "antiguedad",
        header: "Antigüedad",
        accessor: "antiguedad",
        thresholds: antiguedadThresholds,
        minWidth: 140,
      },
      { id: "dias_activo", header: "Días activo", accessor: "dias_activo", columnType: "number" },
      { id: "sigue_activo", header: "Sigue activo", accessor: "sigue_activo" },
      { id: "gasto_30d_usd", header: "Gasto 30 días (USD)", accessor: "gasto_30d_usd", columnType: "number" },
    ]}
    detailFacets={[
      { id: "antiguedad", label: "Antigüedad" },
      { id: "instance_type", label: "Tipo de instancia" },
      { id: "k8s.cluster.name", label: "Clúster" },
    ]}
    detailNoun="nodos vistos en 30 días"
    summaryAside={() => <NodeTrendChart />}
  />
);
