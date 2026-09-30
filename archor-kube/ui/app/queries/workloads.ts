/**
 * Los workloads de Kubernetes con sus labels y annotations, leídos de
 * Smartscape.
 *
 * Es la única fuente de workloads de la app. Antes se leían de la entidad
 * clásica `dt.entity.cloud_application`, pero los tenants nuevos no tienen
 * entidades clásicas: la consulta fallaba entera y con ella todos los módulos
 * que filtran o enriquecen por dueño. Smartscape existe en los dos modelos.
 *
 * Los jobs sueltos quedan fuera a propósito: cada ejecución es un nodo con
 * nombre único y multiplican el inventario sin aportar dueños; los de un
 * CronJob se resuelven por el CronJob.
 */
export const WORKLOAD_NODES = `smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET, K8S_DAEMONSET, K8S_CRONJOB`;

/** Nombre del workload, igual al `k8s.workload.name` de las métricas. */
export const WORKLOAD_NAME = "k8s.workload.name";
export const WORKLOAD_LABELS = "`tags:k8s.labels`";
export const WORKLOAD_ANNOTATIONS = "`tags:k8s.annotations`";
