/**
 * Join reutilizable de tráfico APM por workload (Regla de Oro del ocioso).
 * Suma los requests del periodo por la dimensión `k8s.workload.name` que
 * OneAgent pone en `dt.service.request.count`. Un workload sin fila aquí no
 * tiene servicio APM medible (jobs, cronjobs, sin OneAgent): la evidencia
 * queda solo en CPU.
 *
 * No pasa por entidades de servicio ni de process group: los tenants nuevos
 * no tienen entidades clásicas y la consulta fallaba entera. El id del
 * servicio sale de la misma métrica (`dt.smartscape.service`, o
 * `dt.entity.service` donde solo exista esa dimensión).
 *
 * Limitación conocida: los requests son por nombre de workload, no por
 * clúster; si el mismo workload corre en dos clústers, ambas filas comparten
 * el total.
 */
export const serviceRequestsJoin = (sourceField: string, window = "7d"): string => `| lookup [
    timeseries v = sum(dt.service.request.count),
      by:{k8s.workload.name, dt.smartscape.service, dt.entity.service}, from:now()-${window}
    | filter isNotNull(k8s.workload.name)
    | fieldsAdd req = arraySum(v), sid = coalesce(dt.smartscape.service, dt.entity.service)
    | summarize req_total = sum(req), service_id = takeAny(sid), by:{workload = k8s.workload.name}
    | limit 10000
  ], sourceField:${sourceField}, lookupField:workload, fields:{req_total, service_id}`;
