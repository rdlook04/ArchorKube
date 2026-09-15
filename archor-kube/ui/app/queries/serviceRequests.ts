/**
 * Join reutilizable de tráfico APM por workload (Regla de Oro del ocioso).
 * Mapea servicio → workload vía process group "SpringBoot <workload>" y agrega
 * el total de requests del periodo. Un workload sin fila aquí no tiene servicio
 * APM medible (jobs, cronjobs, no-Java): la evidencia queda solo en CPU.
 *
 * Limitación conocida: los requests son por servicio, no por clúster; si el
 * mismo workload corre en dos clústers, ambas filas comparten el total.
 */
export const serviceRequestsJoin = (sourceField: string, window = "7d"): string => `| lookup [
    fetch dt.entity.service
    | fieldsAdd p_id = runs_on[\`dt.entity.process_group\`]
    | lookup [fetch dt.entity.process_group | fields id, entity.name],
        sourceField:p_id, lookupField:id, prefix:"pg_"
    | filter startsWith(pg_entity.name, "SpringBoot")
    | fieldsAdd workload = replaceString(pg_entity.name, "SpringBoot ", "")
    | fields service_id = id, workload
    | lookup [
        timeseries v = sum(dt.service.request.count), by:{dt.entity.service}, from:now()-${window}
        | fieldsAdd req = arraySum(v)
        | fields \`dt.entity.service\`, req | limit 10000
      ], sourceField:service_id, lookupField:\`dt.entity.service\`, fields:{req}
    | summarize req_total = sum(req), service_id = takeAny(service_id), by:{workload}
    | limit 10000
  ], sourceField:${sourceField}, lookupField:workload, fields:{req_total, service_id}`;
