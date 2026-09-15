import type { IntentPayload } from "@dynatrace-sdk/navigation";

/**
 * Puente hacia Dynatrace Assist (app `dynatrace.davis.copilot`).
 *
 * La app declara en su manifest el intent `ask-question` (addonMode overlay):
 *   properties: { prompt: string (requerido), execute?: boolean, contexts?: [...] }
 * Enviando el intent con recommendedAppId/IntentId se abre el chat directamente
 * (sin diálogo "Open with") como overlay encima de la app, con el prompt cargado
 * y ejecutándose solo gracias a `execute: true`.
 */
export const ASSIST_INTENT_OPTIONS = {
  recommendedAppId: "dynatrace.davis.copilot",
  recommendedIntentId: "ask-question",
} as const;

/** Formatea un valor de la fila para el prompt ("s/d" si no hay dato). */
const val = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "s/d";
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "s/d";
};

/**
 * Prompt en texto plano que le pide a Assist juzgar si ESTE workload es
 * realmente ocioso y por qué, aplicando la Regla de Oro, con toda la
 * evidencia de la fila embebida. También se usa para el botón "Copiar prompt"
 * (pegar en una conversación agéntica nueva de Assist).
 */
export const assistIdlePrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` (abre Assist con el prompt y lo ejecuta). */
export const assistIdlePayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistIdlePrompt(row),
  execute: true,
});

/**
 * Prompt de rightsizing: le pide a Assist juzgar si ESTE pod está mal
 * dimensionado (sobre-aprovisionado, subdimensionado o con throttling) y
 * recomendar requests/limits, con la evidencia de la fila embebida.
 */
export const assistRightsizingPrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para rightsizing. */
export const assistRightsizingPayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistRightsizingPrompt(row),
  execute: true,
});

/**
 * Prompt preventivo: le pide a Assist diagnosticar por qué ESTE workload se
 * reinicia o muere por memoria (OOM), y qué hacer, con la evidencia embebida.
 */
export const assistPreventivePrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para señales preventivas. */
export const assistPreventivePayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistPreventivePrompt(row),
  execute: true,
});

/**
 * Prompt de huérfanos: le pide a Assist juzgar si ESTE workload huérfano
 * (escalado a cero o sin dueño en el catálogo) se puede retirar con seguridad.
 */
export const assistOrphanPrompt = (row: Record<string, unknown>): string => {
  return (
    "Eres un experto en gobernanza y FinOps de Kubernetes. Analiza con kubernetes assist este workload " +
    "que parece huérfano y dime si es seguro retirarlo (borrar el manifiesto) o no, en español y de forma " +
    "concisa. Te paso los datos para que puedas buscarlo. Motivos: REPLICAS_0 = está escalado a cero pero " +
    "el manifiesto sigue definido en el clúster (ocupa inventario y confunde); SIN_REPO_PORT = está " +
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
};

/** Payload del intent `ask-question` para workloads huérfanos. */
export const assistOrphanPayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistOrphanPrompt(row),
  execute: true,
});

/**
 * Prompt de riesgo de caída: le pide a Assist evaluar la resiliencia de ESTE
 * workload (réplica única, probes faltantes) y priorizar la remediación.
 */
export const assistRiskPrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para riesgo de caída. */
export const assistRiskPayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistRiskPrompt(row),
  execute: true,
});

/**
 * Prompt de densidad de nodos: le pide a Assist evaluar si ESTE nodo
 * subutilizado se puede eliminar/consolidar y cómo hacerlo con seguridad.
 */
export const assistNodePrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para densidad de nodos. */
export const assistNodePayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistNodePrompt(row),
  execute: true,
});

/**
 * Prompt de errores en logs: le pide a Assist investigar los errores/críticos
 * de ESTE contenedor y proponer causa raíz y siguiente paso.
 */
export const assistErrorPrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para errores en logs. */
export const assistErrorPayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistErrorPrompt(row),
  execute: true,
});

/**
 * Prompt de throttling: le pide a Assist evaluar el cuello de botella de CPU de
 * ESTE workload y recomendar el ajuste de límite/HPA con la evidencia embebida.
 */
export const assistThrottlePrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para throttling. */
export const assistThrottlePayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistThrottlePrompt(row),
  execute: true,
});

/**
 * Prompt de condición de nodo: le pide a Assist diagnosticar una condición
 * problemática del nodo (NotReady, MemoryPressure, DiskPressure, etc.).
 */
export const assistNodeConditionPrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para condiciones de nodo. */
export const assistNodeConditionPayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistNodeConditionPrompt(row),
  execute: true,
});

/**
 * Prompt de elasticidad HPA: le pide a Assist evaluar si ESTE HPA está mal
 * configurado (bloqueado por el máximo, o sin margen) y cómo ajustarlo.
 */
export const assistElasticityPrompt = (row: Record<string, unknown>): string => {
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
};

/** Payload del intent `ask-question` para elasticidad HPA. */
export const assistElasticityPayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistElasticityPrompt(row),
  execute: true,
});

/**
 * Prompt de cumplimiento (estándar AKS): le pide a Assist priorizar y remediar
 * las specs incumplidas de ESTE workload según su impacto en disponibilidad.
 */
export const assistCompliancePrompt = (row: Record<string, unknown>): string => {
  return (
    "Eres un experto en Kubernetes y buenas prácticas de despliegue (SRE). Analiza con kubernetes assist " +
    "este workload y dime cómo remediar las especificaciones que incumple, priorizando por impacto en " +
    "disponibilidad, en español y de forma concisa. Te paso los datos para que puedas buscarlo. El estándar " +
    "AKS tiene 7 specs con distinto riesgo: 🔴 SPEC06 Readiness Probe y SPEC05 Liveness Probe (causa directa " +
    "de caída: tráfico a pods no listos, contenedores colgados que no se reinician); 🟠 SPEC02 Memory Limit y " +
    "SPEC04 Memory Request (OOM de vecinos, mal scheduling); 🟡 SPEC01 CPU Limit y SPEC03 CPU Request " +
    "(throttling/scheduling subóptimo, no caída dura); ⚪ SPEC07 Non-Root (hardening de seguridad). Recomienda " +
    "en el orden SPEC06 → SPEC05 → SPEC02/04 → SPEC01/03 → SPEC07, con valores concretos de requests/limits y " +
    "ejemplos de probes, y qué validar antes de aplicarlos. Datos observados: " +
    `Workload: ${val(row["k8s.workload.name"])}; ` +
    `Namespace: ${val(row["k8s.namespace.name"])}; ` +
    `Cluster: ${val(row["k8s.cluster.name"])}; ` +
    `Criticidad calculada: ${val(row.criticidad)}; % cumplimiento: ${val(row.cumplimiento_pct)}; ` +
    `SPEC06 Readiness: ${val(row.spec06)}; SPEC05 Liveness: ${val(row.spec05)}; ` +
    `SPEC02 Mem Limit: ${val(row.spec02)}; SPEC04 Mem Request: ${val(row.spec04)}; ` +
    `SPEC01 CPU Limit: ${val(row.spec01)}; SPEC03 CPU Request: ${val(row.spec03)}; ` +
    `SPEC07 Non-Root: ${val(row.spec07)}; ` +
    `Tier: ${val(row.tier)}; Squad: ${val(row.squad)}.`
  );
};

/** Payload del intent `ask-question` para cumplimiento del estándar AKS. */
export const assistCompliancePayload = (row: Record<string, unknown>): IntentPayload => ({
  prompt: assistCompliancePrompt(row),
  execute: true,
});
