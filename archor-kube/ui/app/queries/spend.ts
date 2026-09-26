import type { QueryDef } from "./types";
import { rangeWindow } from "./analysisWindow";
import { HOURS_PER_MONTH, instancePriceClause } from "./costModel";

/**
 * M13 — Gasto de infraestructura.
 *
 * Queries aportadas por el usuario (2026-08-19). A diferencia del resto de
 * módulos, este no busca hallazgos: describe **qué máquinas hay y desde
 * cuándo**, que es la base para saber cuánto se paga.
 *
 * El tipo de instancia sale de la etiqueta `beta.kubernetes.io/instance-type`
 * del nodo. Con ella, el conteo de nodos deja de ser inventario y pasa a ser
 * dinero: una instancia de 2 vCPU / 8 GB cuesta del orden de 70 USD al mes.
 *
 * Prorrateo: la nube factura por hora, no por mes. `dias_activo` cuenta los días
 * con datos dentro de la ventana, así que un nodo que vivió 3 días aporta 3/30
 * del precio mensual y no el mes completo. Sin esto, un clúster con autoscaler
 * agresivo aparentaría gastar mucho más de lo que factura.
 *
 * Limitación de la ventana: con 30 días no se distingue un nodo de 31 días de
 * uno de dos años; `dias_activo` es "días activo dentro de la ventana", no
 * antigüedad real.
 */

/** Ventana común de los tres reportes del módulo. */
const SPEND_WINDOW = rangeWindow(24 * 30, {
  en: "The last 30 days of node activity, in one-day intervals. `dias_activo` counts the days with data inside that window: a node showing 30 was active the whole period or longer, but the window can't tell how much longer.",
  es: "Últimos 30 días de actividad de los nodos, en intervalos de un día. `dias_activo` cuenta los días con datos dentro de esa ventana: un nodo que aparezca con 30 llevaba activo todo el periodo o más, pero la ventana no permite saber cuánto más.",
});

/** Enriquece cada nodo con su tipo de instancia (la etiqueta del nodo). */
const instanceTypeJoin = `| lookup [
    smartscapeNodes K8S_NODE
    | fields k8s.node.name, instance_type = tags[\`beta.kubernetes.io/instance-type\`]
    | limit 10000
  ], sourceField: k8s.node.name, lookupField: k8s.node.name, fields: {instance_type}`;

/**
 * Marca los nodos que siguen vivos.
 *
 * No se puede usar `isNotNull(arrayLast(cpu))`: `arrayLast` devuelve el ultimo
 * valor NO nulo de la serie, asi que da verdadero tambien para nodos que
 * murieron hace semanas (validado 2026-08-19: daba 383 de 383 activos). La
 * comprobacion fiable es si el nodo reporto en las ultimas 24 horas.
 */
const activeTodayJoin = `| lookup [
    timeseries c = avg(dt.kubernetes.node.cpu_allocatable),
      by: {k8s.node.name}, from: now()-24h
    | fields k8s.node.name, visto_24h = "SI"
    | limit 10000
  ], sourceField: k8s.node.name, lookupField: k8s.node.name, fields: {visto_24h}`;

/**
 * Base: un registro por nodo visto en la ventana, con su tipo de instancia y
 * cuántos días estuvo activo.
 */
const nodesSeen = `timeseries cpu = avg(dt.kubernetes.node.cpu_allocatable),
  by: {k8s.node.name, k8s.cluster.name},
  from: now()-30d,
  interval: 1d
| fieldsAdd dias_activo = arraySize(arrayRemoveNulls(cpu))
${activeTodayJoin}
| fieldsAdd sigue_activo = if(isNull(visto_24h), "NO", else: "SI")
| fieldsAdd antiguedad = if(dias_activo >= 28, "VETERANO",
                        else: if(dias_activo >= 7, "RECIENTE", else: "NUEVO"))
${instanceTypeJoin}
${instancePriceClause()}`;

/** Resumen: cuántos nodos hay de cada tipo y cuánto tiempo llevan activos. */
export const spendByInstanceType: QueryDef = {
  id: "spend.by-instance-type",
  module: "spend",
  title: { en: "Nodes by cluster and instance type", es: "Nodos por clúster y tipo de instancia" },
  description:
    { en: "Machine inventory: how many of each type and how many days they were active", es: "Inventario de máquinas: cuántas hay de cada tipo y cuántos días estuvieron activas" },
  window: SPEND_WINDOW,
  build: () => `${nodesSeen}
| fieldsAdd gasto_nodo_30d = dias_activo * 24 * precio_hora
| summarize
    nodos          = count(),
    activos_hoy    = countIf(sigue_activo == "SI"),
    dias_promedio  = round(avg(toDouble(dias_activo)), decimals:1),
    nodo_dias      = sum(dias_activo),
    gasto_30d_usd  = round(sum(gasto_nodo_30d), decimals:0),
    precio_mes_usd = round(takeAny(precio_hora) * ${HOURS_PER_MONTH}, decimals:2),
    by: {k8s.cluster.name, instance_type}
| fieldsAdd ritmo_mes_usd = round(activos_hoy * precio_mes_usd, decimals:0)
| sort gasto_30d_usd desc
| fields k8s.cluster.name, instance_type, nodos, activos_hoy, dias_promedio,
    nodo_dias, precio_mes_usd, gasto_30d_usd, ritmo_mes_usd`,
};

/** Detalle: cada nodo con su tipo, días activo y si sigue vivo. */
export const nodeInventory: QueryDef = {
  id: "spend.node-inventory",
  module: "spend",
  title: { en: "Nodes seen in the last 30 days", es: "Detalle de nodos vistos en los últimos 30 días" },
  description: { en: "Each node with its instance type, days active and age", es: "Cada nodo con su tipo de instancia, días activo y antigüedad" },
  window: SPEND_WINDOW,
  build: () => `${nodesSeen}
| fieldsAdd prioridad = if(antiguedad == "NUEVO", 1,
                       else: if(antiguedad == "RECIENTE", 2, else: 3))
| fieldsAdd gasto_30d_usd = round(dias_activo * 24 * precio_hora, decimals:2)
| sort prioridad asc, k8s.cluster.name asc, k8s.node.name asc
| fields k8s.cluster.name, k8s.node.name, instance_type,
    antiguedad, dias_activo, sigue_activo, gasto_30d_usd, prioridad`,
};

/**
 * Tendencia diaria de nodos activos por clúster, para la gráfica.
 *
 * Consulta del usuario tal cual. Ojo: está por confirmar si `count()` sobre una
 * métrica cuenta nodos o muestras del intervalo; si devuelve miles en vez de
 * decenas, hay que agrupar por `k8s.node.name` y contar series.
 */
export const NODE_TREND_QUERY = `timeseries nodos = count(dt.kubernetes.node.cpu_allocatable),
  by: {k8s.cluster.name},
  from: now()-30d,
  interval: 1d`;
