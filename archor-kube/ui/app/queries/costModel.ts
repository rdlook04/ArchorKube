import {
  HOURS_PER_MONTH,
  INSTANCE_HOURLY_USD,
  USD_GB_MONTH,
  USD_VCPU_MONTH,
} from "../config/site";

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
export { HOURS_PER_MONTH, INSTANCE_HOURLY_USD, USD_GB_MONTH, USD_VCPU_MONTH };

/**
 * Cláusula DQL que agrega `precio_hora` según `instance_type`. Los tipos sin
 * precio conocido quedan nulos, para que se vean como hueco y no se confundan
 * con gasto cero.
 */
export const instancePriceClause = (): string => {
  const entries = Object.entries(INSTANCE_HOURLY_USD);
  // Sin tabla de precios el campo se emite en null igual: los módulos que lo
  // usan siguen corriendo y muestran el gasto como desconocido, en vez de
  // fallar la consulta entera por un dato de configuración que falta.
  if (entries.length === 0) return "| fieldsAdd precio_hora = null";
  const body = entries
    .map(([sku, price]) => `instance_type == "${sku}", ${price}`)
    .join(", else: if(");
  return `| fieldsAdd precio_hora = if(${body}, else: null${")".repeat(entries.length)}`;
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
