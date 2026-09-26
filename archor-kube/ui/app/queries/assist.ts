import type { IntentPayload } from "@dynatrace-sdk/navigation";

import type { Lang } from "../i18n";

/**
 * Puente hacia Dynatrace Assist (app `dynatrace.davis.copilot`).
 *
 * La app declara en su manifest el intent `ask-question` (addonMode overlay):
 *   properties: { prompt: string (requerido), execute?: boolean, contexts?: [...] }
 * Enviando el intent con recommendedAppId/IntentId se abre el chat directamente
 * (sin diálogo "Open with") como overlay encima de la app, con el prompt cargado
 * y ejecutándose solo gracias a `execute: true`.
 *
 * Los prompts salen en el idioma del usuario y le piden a la IA que responda en
 * ese mismo idioma. Los mismos textos van a las IAs externas, siempre después
 * de pasar por el filtro de datos (ai/redact.ts).
 */
export const ASSIST_INTENT_OPTIONS = {
  recommendedAppId: "dynatrace.davis.copilot",
  recommendedIntentId: "ask-question",
} as const;

type Row = Record<string, unknown>;

/** Formatea un valor de la fila para el prompt ("n/a" / "s/d" si no hay dato). */
const valueIn =
  (lang: Lang) =>
  (value: unknown): string => {
    const missing = lang === "es" ? "s/d" : "n/a";
    if (value === null || value === undefined || value === "") return missing;
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : missing;
  };

/** Payload del intent `ask-question`: abre Assist con el prompt y lo ejecuta. */
const payload = (prompt: string): IntentPayload => ({ prompt, execute: true });

/**
 * Ocioso: ¿es REALMENTE un workload ocioso? Aplica la Regla de Oro con toda la
 * evidencia de la fila.
 */
export const assistIdlePrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y FinOps. Analiza con kubernetes assist este workload y dime si es " +
      "REALMENTE un workload ocioso (idle) te paso las metricas con el fin de que puedas buscarlas y por qué, en español y de forma concisa. " +
      "Aplica la Regla de Oro del workload ocioso: (1) tráfico comercial <=10 requests " +
      "por semana en APM, (2) sin OOMKilled ni bucles de reinicio, (3) uso de CPU " +
      "cercano a 0 sostenido. Concluye si se puede escalar a cero de forma segura " +
      "(KEDA/HPA) y qué validar antes. Datos observados en los últimos 7 días: " +
      `Workload: ${val(row["k8s.workload.name"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Veredicto calculado: ${val(row.veredicto)}; ` +
      `Motivo: ${val(row.motivo)}; ` +
      `Requests APM 7d: ${val(row.req_total)}; ` +
      `CPU avg (mc): ${val(row.cpu_avg)}; CPU max (mc): ${val(row.cpu_max)}; ` +
      `MEM avg (MB): ${val(row.mem_avg_mb)}; ` +
      `CPU reservada (mc): ${val(row.req_cpu_mc)}; MEM reservada (MB): ${val(row.req_mem_mb)}; ` +
      `Restarts 7d: ${val(row.restarts_7d)}; OOM 7d: ${val(row.ooms_7d)}; ` +
      `Costo estimado (USD/mes): ${val(row.perdida_mes_usd)}.`
    );
  }
  return (
    "You are a Kubernetes and FinOps expert. Using the Dynatrace Kubernetes data, analyze this workload and " +
    "tell me whether it is REALLY an idle workload and why, in English and concisely. I'm giving you the " +
    "metrics so you can look them up. Apply the idle workload golden rule: (1) business traffic of 10 " +
    "requests or fewer per week in APM, (2) no OOMKilled or restart loops, (3) sustained CPU usage close " +
    "to 0. Conclude whether it can be safely scaled to zero (KEDA/HPA) and what to check first. Data " +
    "observed over the last 7 days: " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Computed verdict: ${val(row.veredicto)}; ` +
    `Reason: ${val(row.motivo)}; ` +
    `APM requests 7d: ${val(row.req_total)}; ` +
    `CPU avg (mc): ${val(row.cpu_avg)}; CPU max (mc): ${val(row.cpu_max)}; ` +
    `MEM avg (MB): ${val(row.mem_avg_mb)}; ` +
    `Reserved CPU (mc): ${val(row.req_cpu_mc)}; Reserved MEM (MB): ${val(row.req_mem_mb)}; ` +
    `Restarts 7d: ${val(row.restarts_7d)}; OOM 7d: ${val(row.ooms_7d)}; ` +
    `Estimated cost (USD/month): ${val(row.perdida_mes_usd)}.`
  );
};

export const assistIdlePayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistIdlePrompt(row, lang));

/**
 * Rightsizing: ¿está ESTE pod mal dimensionado (sobre-aprovisionado,
 * subdimensionado o con throttling)? Recomienda requests/limits.
 */
export const assistRightsizingPrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y FinOps. Analiza con kubernetes assist este pod y dime si está " +
      "REALMENTE mal dimensionado y por qué, en español y de forma concisa. Te paso las métricas para " +
      "que puedas buscarlas. Criterios: (1) sobre-aprovisionado = requests muy por encima del uso real " +
      "(slack alto) → desperdicio de dinero; (2) subdimensionado = uso por encima de requests (slack " +
      "negativo) → riesgo de desalojo/OOM; (3) throttling crítico = el límite de CPU estrangula el pod. " +
      "Recomienda valores concretos de requests y limits de CPU y memoria (con margen de seguridad) y " +
      "qué validar antes de aplicarlos (picos, HPA, estacionalidad). Datos observados (últimas 2 horas): " +
      `Workload: ${val(row["k8s.workload.name"])}; ` +
      `Pod: ${val(row["k8s.pod.name"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Problema calculado: ${val(row.problema)}; ` +
      `CPU uso avg (mc): ${val(row.cpu_usage_avg)}; CPU request avg (mc): ${val(row.cpu_request_avg)}; ` +
      `CPU slack: ${val(row.cpu_slack_mcores)} mc (${val(row.cpu_slack_pct)}%); ` +
      `CPU throttling: ${val(row.cpu_throttle_pct)}%; ` +
      `MEM uso avg (bytes): ${val(row.mem_usage_avg)}; MEM request avg (bytes): ${val(row.mem_request_avg)}; ` +
      `MEM slack: ${val(row.mem_slack_mb)} MB (${val(row.mem_slack_pct)}%); ` +
      `Desperdicio estimado (USD/mes): ${val(row.perdida_mes_usd)}.`
    );
  }
  return (
    "You are a Kubernetes and FinOps expert. Using the Dynatrace Kubernetes data, analyze this pod and tell " +
    "me whether it is REALLY mis-sized and why, in English and concisely. I'm giving you the metrics so you " +
    "can look them up. Criteria: (1) over-provisioned = requests far above real usage (high slack) → wasted " +
    "money; (2) under-requested = usage above requests (negative slack) → risk of eviction/OOM; (3) " +
    "critical throttling = the CPU limit is choking the pod. Recommend concrete CPU and memory requests and " +
    "limits (with a safety margin) and what to check before applying them (peaks, HPA, seasonality). Data " +
    "observed (last 2 hours): " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Pod: ${val(row["k8s.pod.name"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Computed problem: ${val(row.problema)}; ` +
    `CPU usage avg (mc): ${val(row.cpu_usage_avg)}; CPU request avg (mc): ${val(row.cpu_request_avg)}; ` +
    `CPU slack: ${val(row.cpu_slack_mcores)} mc (${val(row.cpu_slack_pct)}%); ` +
    `CPU throttling: ${val(row.cpu_throttle_pct)}%; ` +
    `MEM usage avg (bytes): ${val(row.mem_usage_avg)}; MEM request avg (bytes): ${val(row.mem_request_avg)}; ` +
    `MEM slack: ${val(row.mem_slack_mb)} MB (${val(row.mem_slack_pct)}%); ` +
    `Estimated waste (USD/month): ${val(row.perdida_mes_usd)}.`
  );
};

export const assistRightsizingPayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistRightsizingPrompt(row, lang));

/** Preventiva: ¿por qué ESTE workload se reinicia o muere por memoria, y qué hacer? */
export const assistPreventivePrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y SRE. Analiza con kubernetes assist este workload y dime por qué " +
      "presenta esta señal de degradación y cómo remediarlo, en español y de forma concisa. Te paso las " +
      "métricas para que puedas buscarlas. Señales: OOM_KILL = el contenedor fue matado por superar el " +
      "límite de memoria (¿límite bajo o fuga de memoria?); RESTART_LOOP = se reinicia en bucle (>10 en " +
      "24h, revisa crash de arranque, probes mal configuradas, dependencias); RESTARTS_ELEVADOS = " +
      "reinicios frecuentes (>3 en 24h). Distingue si conviene subir el límite de memoria o si hay un bug/" +
      "fuga, y qué validar (tendencia de memoria, logs de crash, readiness/liveness). Datos observados " +
      "(últimas 24 horas): " +
      `Workload: ${val(row["k8s.workload.name"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Señal calculada: ${val(row.senal)}; ` +
      `Restarts 24h: ${val(row.restarts_24h)}; OOM kills 24h: ${val(row.ooms_24h)}; ` +
      `MEM uso avg (MB): ${val(row.mem_avg_mb)}; MEM límite (MB): ${val(row.mem_limit_mb)}; ` +
      `Uso vs límite: ${val(row.mem_uso_pct)}%.`
    );
  }
  return (
    "You are a Kubernetes and SRE expert. Using the Dynatrace Kubernetes data, analyze this workload and tell " +
    "me why it shows this degradation signal and how to fix it, in English and concisely. I'm giving you the " +
    "metrics so you can look them up. Signals: OOM_KILL = the container was killed for going over its memory " +
    "limit (limit too low or a memory leak?); RESTART_LOOP = it restarts in a loop (>10 in 24h; check " +
    "startup crashes, misconfigured probes, dependencies); RESTARTS_ELEVADOS = frequent restarts (>3 in " +
    "24h). Tell whether the memory limit should be raised or there's a bug/leak, and what to check (memory " +
    "trend, crash logs, readiness/liveness). Data observed (last 24 hours): " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Computed signal: ${val(row.senal)}; ` +
    `Restarts 24h: ${val(row.restarts_24h)}; OOM kills 24h: ${val(row.ooms_24h)}; ` +
    `MEM usage avg (MB): ${val(row.mem_avg_mb)}; MEM limit (MB): ${val(row.mem_limit_mb)}; ` +
    `Usage vs limit: ${val(row.mem_uso_pct)}%.`
  );
};

export const assistPreventivePayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistPreventivePrompt(row, lang));

/** Huérfanos: ¿se puede retirar ESTE workload con seguridad? */
export const assistOrphanPrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en gobernanza y FinOps de Kubernetes. Analiza con kubernetes assist este workload " +
      "que parece huérfano y dime si es seguro retirarlo (borrar el manifiesto) o no, en español y de forma " +
      "concisa. Te paso los datos para que puedas buscarlo. Motivos: REPLICAS_0 = está escalado a cero pero " +
      "el manifiesto sigue definido en el clúster (ocupa inventario y confunde); SIN_DUENO = está " +
      "corriendo pero su nombre no existe en el catálogo de propiedad, así que no tiene dueño organizacional " +
      "identificable. Antes de recomendar borrar, indica qué validar (¿es un job/cronjob legítimo?, " +
      "¿dependencias de otros servicios?, ¿tráfico o datos persistentes?, ¿quién lo desplegó?). Datos: " +
      `Workload: ${val(row["k8s.workload.name"])}; ` +
      `Kind: ${val(row["k8s.workload.kind"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Motivo calculado: ${val(row.motivo)}; ` +
      `Réplicas definidas: ${val(row.replicas)}; ` +
      `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}; AppCode: ${val(row.appCode)}.`
    );
  }
  return (
    "You are a Kubernetes governance and FinOps expert. Using the Dynatrace Kubernetes data, analyze this " +
    "workload that looks orphaned and tell me whether it's safe to remove (delete the manifest) or not, in " +
    "English and concisely. I'm giving you the data so you can look it up. Reasons: REPLICAS_0 = it's scaled " +
    "to zero but the manifest is still defined in the cluster (it takes up inventory and confuses people); " +
    "SIN_DUENO = it's running but its name doesn't exist in the ownership catalog, so it has no identifiable " +
    "organizational owner. Before recommending deletion, say what to check (is it a legitimate job/cronjob? " +
    "dependencies from other services? traffic or persistent data? who deployed it?). Data: " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Kind: ${val(row["k8s.workload.kind"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Computed reason: ${val(row.motivo)}; ` +
    `Defined replicas: ${val(row.replicas)}; ` +
    `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}; AppCode: ${val(row.appCode)}.`
  );
};

export const assistOrphanPayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistOrphanPrompt(row, lang));

/** Riesgo de caída: ¿qué tan real es el riesgo de ESTE workload y cómo remediarlo? */
export const assistRiskPrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y confiabilidad (SRE). Analiza con kubernetes assist este workload y " +
      "dime qué tan real es su riesgo de caída y cómo remediarlo, en español y de forma concisa. Te paso los " +
      "datos para que puedas buscarlo. El score (0-3) suma tres factores de fragilidad: réplica única (sin " +
      "redundancia, un solo pod = punto único de falla), falta de liveness probe (Kubernetes no reinicia un " +
      "contenedor colgado) y falta de readiness probe (envía tráfico a pods que aún no están listos). " +
      "Prioriza según el tier del servicio y recomienda acciones concretas (subir réplicas + PodDisruptionBudget, " +
      "añadir las probes que faltan) y qué validar antes (estado, dependencias, si es un singleton legítimo). Datos: " +
      `Workload: ${val(row["k8s.workload.name"])}; ` +
      `Kind: ${val(row["k8s.workload.kind"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Nivel: ${val(row.nivel)}; Score: ${val(row.risk_score)}; ` +
      `Réplicas: ${val(row.replicas)}; Réplica única: ${val(row.single_replica)}; ` +
      `Liveness: ${val(row.liveness_gap)}; Readiness: ${val(row.readiness_gap)}; ` +
      `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
    );
  }
  return (
    "You are a Kubernetes and reliability (SRE) expert. Using the Dynatrace Kubernetes data, analyze this " +
    "workload and tell me how real its outage risk is and how to fix it, in English and concisely. I'm giving " +
    "you the data so you can look it up. The score (0-3) adds up three fragility factors: single replica (no " +
    "redundancy, one pod = single point of failure), missing liveness probe (Kubernetes doesn't restart a hung " +
    "container) and missing readiness probe (it sends traffic to pods that aren't ready yet). Prioritize by the " +
    "service tier and recommend concrete actions (raise replicas + PodDisruptionBudget, add the missing probes) " +
    "and what to check first (state, dependencies, whether it's a legitimate singleton). Data: " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Kind: ${val(row["k8s.workload.kind"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Level: ${val(row.nivel)}; Score: ${val(row.risk_score)}; ` +
    `Replicas: ${val(row.replicas)}; Single replica: ${val(row.single_replica)}; ` +
    `Liveness: ${val(row.liveness_gap)}; Readiness: ${val(row.readiness_gap)}; ` +
    `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
  );
};

export const assistRiskPayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistRiskPrompt(row, lang));

/** Nodos: ¿conviene eliminar o consolidar ESTE nodo subutilizado, y cómo? */
export const assistNodePrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y FinOps de infraestructura. Analiza con kubernetes assist este nodo " +
      "subutilizado y dime si conviene eliminarlo o consolidar su carga, y cómo hacerlo con seguridad, en " +
      "español y de forma concisa. Te paso los datos para que puedas buscarlo. Acciones: CANDIDATO_ELIMINAR " +
      "= el clúster tiene más nodos que los mínimos necesarios y este está casi vacío (densidad <5%); " +
      "CONSOLIDAR_SI_ES_POSIBLE = densidad baja (<15%), sus pods podrían caber en otros nodos; MONITOREAR = " +
      "subutilizado pero sin margen claro de acción. Recomienda pasos concretos (cordon/drain, revisar " +
      "afinidades/taints, PodDisruptionBudgets, autoscaler del clúster) y qué validar antes de retirar el " +
      "nodo. Datos observados: " +
      `Nodo: ${val(row["k8s.node.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Acción calculada: ${val(row.accion)}; ` +
      `Densidad de pods: ${val(row.pod_density_pct)}%; ` +
      `Pods corriendo: ${val(row.pods_running_avg)} de ${val(row.pods_max_avg)}; ` +
      `CPU asignable (cores): ${val(row.cpu_alloc_cores)}; CPU ociosa: ${val(row.cpu_idle_pct)}%; ` +
      `MEM asignable (GB): ${val(row.mem_alloc_gb)}; MEM ociosa: ${val(row.mem_idle_pct)}%; ` +
      `Nodos del clúster: ${val(row.cluster_nodos)}; Nodos mínimos: ${val(row.nodos_minimos_cluster)}; ` +
      `Ahorro potencial (USD/mes): ${val(row.ahorro_mes_usd)}.`
    );
  }
  return (
    "You are a Kubernetes and infrastructure FinOps expert. Using the Dynatrace Kubernetes data, analyze this " +
    "underused node and tell me whether it's worth removing it or consolidating its load, and how to do it " +
    "safely, in English and concisely. I'm giving you the data so you can look it up. Actions: " +
    "CANDIDATO_ELIMINAR = the cluster has more nodes than the minimum needed and this one is almost empty " +
    "(density <5%); CONSOLIDAR_SI_ES_POSIBLE = low density (<15%), its pods could fit on other nodes; " +
    "MONITOREAR = underused but with no clear margin for action. Recommend concrete steps (cordon/drain, " +
    "review affinities/taints, PodDisruptionBudgets, cluster autoscaler) and what to check before removing " +
    "the node. Observed data: " +
    `Node: ${val(row["k8s.node.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Computed action: ${val(row.accion)}; ` +
    `Pod density: ${val(row.pod_density_pct)}%; ` +
    `Running pods: ${val(row.pods_running_avg)} of ${val(row.pods_max_avg)}; ` +
    `Allocatable CPU (cores): ${val(row.cpu_alloc_cores)}; Idle CPU: ${val(row.cpu_idle_pct)}%; ` +
    `Allocatable MEM (GB): ${val(row.mem_alloc_gb)}; Idle MEM: ${val(row.mem_idle_pct)}%; ` +
    `Cluster nodes: ${val(row.cluster_nodos)}; Minimum nodes: ${val(row.nodos_minimos_cluster)}; ` +
    `Potential savings (USD/month): ${val(row.ahorro_mes_usd)}.`
  );
};

export const assistNodePayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistNodePrompt(row, lang));

/** Errores: causa raíz probable de los errores de ESTE contenedor y siguiente paso. */
export const assistErrorPrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y análisis de logs (SRE). Investiga con kubernetes assist los errores de " +
      "ESTE contenedor y dime la causa raíz probable y el siguiente paso, en español y de forma concisa. Te " +
      "paso los datos para que puedas buscar sus logs. Revisa los patrones de error más frecuentes en las " +
      "últimas 24 horas, distingue errores esperables (reintentos, 4xx de clientes) de fallas reales " +
      "(excepciones, timeouts, 5xx, dependencias caídas), y prioriza según el tier del servicio. Indica qué " +
      "consulta de logs correr para profundizar. Datos observados (últimas 24h): " +
      `Contenedor: ${val(row["k8s.container.name"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Severidad: ${val(row.severidad)}; ` +
      `Errores 24h: ${val(row.errores)}; Críticos 24h (CRITICAL/FATAL/etc): ${val(row.criticos)}; ` +
      `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
    );
  }
  return (
    "You are a Kubernetes and log analysis (SRE) expert. Using the Dynatrace data, investigate the errors of " +
    "THIS container and tell me the likely root cause and the next step, in English and concisely. I'm giving " +
    "you the data so you can look up its logs. Review the most frequent error patterns in the last 24 hours, " +
    "separate expected errors (retries, client 4xx) from real failures (exceptions, timeouts, 5xx, dependencies " +
    "down), and prioritize by the service tier. Say which log query to run to dig deeper. Data observed (last " +
    "24h): " +
    `Container: ${val(row["k8s.container.name"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Severity: ${val(row.severidad)}; ` +
    `Errors 24h: ${val(row.errores)}; Criticals 24h (CRITICAL/FATAL/etc): ${val(row.criticos)}; ` +
    `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
  );
};

export const assistErrorPayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistErrorPrompt(row, lang));

/** Throttling: ¿qué tan real es el cuello de botella de CPU de ESTE workload y cómo resolverlo? */
export const assistThrottlePrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y rendimiento. Analiza con kubernetes assist este workload que sufre " +
      "CPU throttling y dime qué tan real es el cuello de botella y cómo resolverlo, en español y de forma " +
      "concisa. Te paso las métricas para que puedas buscarlas. El throttling ocurre cuando el uso golpea el " +
      "límite de CPU (limits.cpu) y el kernel estrangula el contenedor: sufre latencia aunque el nodo tenga " +
      "CPU libre. Se mide por el PICO en 24h (no el promedio, que esconde los cuellos intermitentes). " +
      "Recomienda acciones concretas (subir o quitar el limit de CPU, revisar requests, escalar horizontal " +
      "con HPA) y qué validar antes (si el pico coincide con arranque/batch, si hay un HPA activo). Datos " +
      "observados (últimas 24h): " +
      `Workload: ${val(row["k8s.workload.name"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Severidad: ${val(row.severidad)}; ` +
      `Límite CPU avg (mc): ${val(row.limit_avg)}; ` +
      `Throttling pico (mc): ${val(row.throttle_peak)}; Pico vs límite: ${val(row.throttle_peak_pct)}%; ` +
      `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
    );
  }
  return (
    "You are a Kubernetes and performance expert. Using the Dynatrace Kubernetes data, analyze this workload " +
    "suffering CPU throttling and tell me how real the bottleneck is and how to solve it, in English and " +
    "concisely. I'm giving you the metrics so you can look them up. Throttling happens when usage hits the " +
    "CPU limit (limits.cpu) and the kernel chokes the container: it suffers latency even when the node has " +
    "spare CPU. It's measured by the PEAK over 24h (not the average, which hides intermittent bottlenecks). " +
    "Recommend concrete actions (raise or remove the CPU limit, review requests, scale horizontally with an " +
    "HPA) and what to check first (whether the peak matches startup/batch, whether an HPA is active). Data " +
    "observed (last 24h): " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Severity: ${val(row.severidad)}; ` +
    `CPU limit avg (mc): ${val(row.limit_avg)}; ` +
    `Peak throttling (mc): ${val(row.throttle_peak)}; Peak vs limit: ${val(row.throttle_peak_pct)}%; ` +
    `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
  );
};

export const assistThrottlePayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistThrottlePrompt(row, lang));

/** Condición de nodo: causa probable de una condición problemática (NotReady, presión…). */
export const assistNodeConditionPrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y operación de clústers (SRE). Diagnostica con kubernetes assist esta " +
      "condición problemática del nodo y dime la causa probable y cómo remediarla, en español y de forma " +
      "concisa. Contexto: en AKS el control plane es administrado por Azure; lo visible son las condiciones " +
      "que kubelet/node-problem-detector reportan por nodo (Ready≠True = el nodo no acepta pods; " +
      "MemoryPressure/DiskPressure/PIDPressure = presión de recursos que puede desalojar pods; otras como " +
      "KernelDeadlock indican problemas del SO). Recomienda pasos concretos (cordon/drain, revisar disco/" +
      "memoria del host, reiniciar kubelet, reemplazar el nodo) y qué validar. Datos: " +
      `Nodo: ${val(row["k8s.node.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Condición: ${val(row.condicion)}; Estado: ${val(row.estado)}; ` +
      `Razón: ${val(row.razon)}; Mensaje: ${val(row.mensaje)}.`
    );
  }
  return (
    "You are a Kubernetes and cluster operations (SRE) expert. Using the Dynatrace Kubernetes data, diagnose " +
    "this problem node condition and tell me the likely cause and how to fix it, in English and concisely. " +
    "Context: in AKS the control plane is managed by Azure; what's visible are the conditions " +
    "kubelet/node-problem-detector report per node (Ready≠True = the node doesn't accept pods; " +
    "MemoryPressure/DiskPressure/PIDPressure = resource pressure that can evict pods; others such as " +
    "KernelDeadlock point to OS problems). Recommend concrete steps (cordon/drain, check host disk/memory, " +
    "restart kubelet, replace the node) and what to check. Data: " +
    `Node: ${val(row["k8s.node.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Condition: ${val(row.condicion)}; Status: ${val(row.estado)}; ` +
    `Reason: ${val(row.razon)}; Message: ${val(row.mensaje)}.`
  );
};

export const assistNodeConditionPayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistNodeConditionPrompt(row, lang));

/** Elasticidad: ¿está bien configurado ESTE HPA y cómo ajustarlo? */
export const assistElasticityPrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y autoscaling. Analiza con kubernetes assist este HorizontalPodAutoscaler " +
      "y dime si está bien configurado y cómo ajustarlo, en español y de forma concisa. Te paso los datos para " +
      "que puedas buscarlo. Estados: BLOQUEADO_NECESITA_MAX = el HPA quiere más réplicas de las que permite su " +
      "maxReplicas (condición TooManyReplicas) → está topado y no puede absorber más carga; SIN_MARGEN_MIN_ES_MAX " +
      "= minReplicas == maxReplicas, así que el HPA no escala nada (elasticidad anulada); OK = con margen. " +
      "Recomienda valores concretos de min/maxReplicas según la carga y qué validar (métrica objetivo del HPA, " +
      "capacidad de los nodos, si el tope es intencional). Datos: " +
      `HPA: ${val(row.hpa_name)}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Estado: ${val(row.elasticidad)}; ` +
      `min: ${val(row.hpa_min)}; max: ${val(row.hpa_max)}; ` +
      `réplicas actuales: ${val(row.hpa_current)}; deseadas: ${val(row.hpa_desired)}; ` +
      `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
    );
  }
  return (
    "You are a Kubernetes and autoscaling expert. Using the Dynatrace Kubernetes data, analyze this " +
    "HorizontalPodAutoscaler and tell me whether it's well configured and how to adjust it, in English and " +
    "concisely. I'm giving you the data so you can look it up. States: BLOQUEADO_NECESITA_MAX = the HPA wants " +
    "more replicas than its maxReplicas allows (condition TooManyReplicas) → it's capped and can't absorb more " +
    "load; SIN_MARGEN_MIN_ES_MAX = minReplicas == maxReplicas, so the HPA doesn't scale at all (elasticity " +
    "switched off); OK = has headroom. Recommend concrete min/maxReplicas values for the load and what to check " +
    "(the HPA target metric, node capacity, whether the cap is intentional). Data: " +
    `HPA: ${val(row.hpa_name)}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `State: ${val(row.elasticidad)}; ` +
    `min: ${val(row.hpa_min)}; max: ${val(row.hpa_max)}; ` +
    `current replicas: ${val(row.hpa_current)}; desired: ${val(row.hpa_desired)}; ` +
    `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
  );
};

export const assistElasticityPayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistElasticityPrompt(row, lang));

/**
 * Cumplimiento: cómo remediar las specs que incumple ESTE workload, priorizando
 * por impacto en disponibilidad. El estándar tiene 8 specs (SPEC08 Helm incluida).
 */
export const assistCompliancePrompt = (row: Row, lang: Lang = "en"): string => {
  const val = valueIn(lang);
  if (lang === "es") {
    return (
      "Eres un experto en Kubernetes y buenas prácticas de despliegue (SRE). Analiza con kubernetes assist " +
      "este workload y dime cómo remediar las especificaciones que incumple, priorizando por impacto en " +
      "disponibilidad, en español y de forma concisa. Te paso los datos para que puedas buscarlo. El estándar " +
      "AKS tiene 8 specs con distinto riesgo: 🔴 SPEC06 Readiness Probe y SPEC05 Liveness Probe (causa directa " +
      "de caída: tráfico a pods no listos, contenedores colgados que no se reinician); 🟠 SPEC02 Memory Limit y " +
      "SPEC04 Memory Request (OOM de vecinos, mal scheduling); 🟡 SPEC01 CPU Limit y SPEC03 CPU Request " +
      "(throttling/scheduling subóptimo, no caída dura); ⚪ SPEC07 Non-Root (hardening de seguridad); ⚪ SPEC08 " +
      "Helm (trazabilidad del despliegue). Recomienda en el orden SPEC06 → SPEC05 → SPEC02/04 → SPEC01/03 → " +
      "SPEC07 → SPEC08, con valores concretos de requests/limits y ejemplos de probes, y qué validar antes de " +
      "aplicarlos. Datos observados: " +
      `Workload: ${val(row["k8s.workload.name"])}; ` +
      `Namespace: ${val(row["k8s.namespace.name"])}; ` +
      `Cluster: ${val(row["k8s.cluster.name"])}; ` +
      `Criticidad calculada: ${val(row.criticidad)}; % cumplimiento: ${val(row.cumplimiento_pct)}; ` +
      `SPEC06 Readiness: ${val(row.spec06)}; SPEC05 Liveness: ${val(row.spec05)}; ` +
      `SPEC02 Mem Limit: ${val(row.spec02)}; SPEC04 Mem Request: ${val(row.spec04)}; ` +
      `SPEC01 CPU Limit: ${val(row.spec01)}; SPEC03 CPU Request: ${val(row.spec03)}; ` +
      `SPEC07 Non-Root: ${val(row.spec07)}; SPEC08 Helm: ${val(row.spec08)}; ` +
      `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
    );
  }
  return (
    "You are a Kubernetes and deployment best practices (SRE) expert. Using the Dynatrace Kubernetes data, " +
    "analyze this workload and tell me how to fix the specs it misses, prioritizing by impact on availability, " +
    "in English and concisely. I'm giving you the data so you can look it up. The AKS standard has 8 specs with " +
    "different risk: 🔴 SPEC06 Readiness Probe and SPEC05 Liveness Probe (direct cause of outage: traffic to " +
    "pods that aren't ready, hung containers that don't restart); 🟠 SPEC02 Memory Limit and SPEC04 Memory " +
    "Request (neighbor OOMs, poor scheduling); 🟡 SPEC01 CPU Limit and SPEC03 CPU Request (throttling/" +
    "suboptimal scheduling, no hard outage); ⚪ SPEC07 Non-Root (security hardening); ⚪ SPEC08 Helm " +
    "(deployment traceability). Recommend in the order SPEC06 → SPEC05 → SPEC02/04 → SPEC01/03 → SPEC07 → " +
    "SPEC08, with concrete requests/limits values and probe examples, and what to check before applying them. " +
    "Observed data: " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Computed criticality: ${val(row.criticidad)}; % compliance: ${val(row.cumplimiento_pct)}; ` +
    `SPEC06 Readiness: ${val(row.spec06)}; SPEC05 Liveness: ${val(row.spec05)}; ` +
    `SPEC02 Mem Limit: ${val(row.spec02)}; SPEC04 Mem Request: ${val(row.spec04)}; ` +
    `SPEC01 CPU Limit: ${val(row.spec01)}; SPEC03 CPU Request: ${val(row.spec03)}; ` +
    `SPEC07 Non-Root: ${val(row.spec07)}; SPEC08 Helm: ${val(row.spec08)}; ` +
    `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
  );
};

export const assistCompliancePayload = (row: Row, lang: Lang = "en"): IntentPayload =>
  payload(assistCompliancePrompt(row, lang));
