import { HOURS_PER_MONTH, USD_GB_MONTH, USD_VCPU_MONTH } from "../config/site";
import { LIST_BASE, OWN_PRICES, PRICE_TABLE } from "../config/pricing";

/**
 * Modelo de costos para estimar la pérdida mensual (FinOps).
 *
 * Los precios son de cada instalación y viven en `config/site.ts`; aquí solo
 * se convierten en las cláusulas DQL que los módulos consumen.
 *
 * Prorrateado 50/50 entre CPU y memoria, el precio por unidad es coherente con
 * la flota entera y no solo con un tipo de máquina, siempre que los tipos
 * guarden proporción entre tamaño y precio.
 */
export { HOURS_PER_MONTH, USD_GB_MONTH, USD_VCPU_MONTH };

/** Tabla de precios en línea, como `data`, unida por tipo de instancia. */
const dataLookup = (prices: Record<string, number>, field: string): string => {
  const rows = Object.entries(prices)
    .map(([sku, price]) => `record(t = "${sku.replace(/["\\]/g, "")}", p = ${Number(price)})`)
    .join(", ");
  return `| lookup [data ${rows}], sourceField:instance_type, lookupField:t, fields:{${field} = p}`;
};

/**
 * Cláusula DQL que agrega `precio_hora` según `instance_type`. Los tipos sin
 * precio conocido quedan nulos, para que se vean como hueco y no se confundan
 * con gasto cero.
 *
 * Cada capa de precios (propios, tabla de Grail, lista de la nube) se une por
 * separado y gana la primera que tenga precio. Las tablas viajan como `data` y
 * se unen con `lookup`: con una base de lista son cientos de tipos, y un `if`
 * anidado por tipo no escala.
 */
export const instancePriceClause = (): string => {
  const layers: { field: string; clause: string }[] = [];
  if (Object.keys(OWN_PRICES).length > 0) {
    layers.push({ field: "p_own", clause: dataLookup(OWN_PRICES, "p_own") });
  }
  if (PRICE_TABLE) {
    layers.push({
      field: "p_table",
      clause: `| lookup [load "${PRICE_TABLE}" | fields t = instance_type, p = toDouble(usd_per_hour)], sourceField:instance_type, lookupField:t, fields:{p_table = p}`,
    });
  }
  if (LIST_BASE) {
    layers.push({ field: "p_list", clause: dataLookup(LIST_BASE.prices, "p_list") });
  }
  // Sin ninguna capa el campo se emite en null igual: los módulos que lo usan
  // siguen corriendo y muestran el gasto como desconocido, en vez de fallar la
  // consulta entera por un dato de configuración que falta.
  if (layers.length === 0) return "| fieldsAdd precio_hora = null";
  const fields = layers.map((l) => l.field);
  const value = fields.length === 1 ? fields[0] : `coalesce(${fields.join(", ")})`;
  return `${layers.map((l) => l.clause).join("\n")}
| fieldsAdd precio_hora = ${value}
| fieldsRemove ${fields.join(", ")}`;
};

/**
 * Join reutilizable de recursos reservados (requests) por workload: foto de la
 * última hora, promedio por pod/contenedor y suma por workload. No usar
 * sum(requests_*) directo en timeseries: suma las muestras dentro de cada
 * bucket e infla ~60x (validado 2026-07-13).
 *
 * Limitación: agregado por nombre de workload; si el mismo nombre corre en dos
 * clústers, la fila muestra la reserva combinada.
 */
export const reservedResourcesJoin = (sourceField: string): string => `| lookup [
    timeseries {
      rc = avg(dt.kubernetes.container.requests_cpu),
      rm = avg(dt.kubernetes.container.requests_memory)
    }, by: {k8s.workload.name, k8s.cluster.name, k8s.pod.name, k8s.container.name}, from: now()-1h, union:true
    | fieldsAdd rc_v = arrayAvg(rc), rm_v = arrayAvg(rm)
    | summarize req_cpu_mc = round(sum(rc_v)), req_mem_mb = round(sum(rm_v) / 1048576), by: {k8s.workload.name}
    | limit 10000
  ], sourceField:${sourceField}, lookupField:\`k8s.workload.name\`, fields:{req_cpu_mc, req_mem_mb}`;
