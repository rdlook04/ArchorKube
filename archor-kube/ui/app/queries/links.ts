import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";

/**
 * Deep links a las apps nativas de Dynatrace, para saltar del hallazgo a la
 * entidad real (servicio clásico / workload K8s en Smartscape).
 *
 * La URL del environment **no se interpola en el DQL**: las queries devuelven
 * solo el id de la entidad y el enlace se arma aquí, en el navegador, con la
 * URL del tenant donde la app está corriendo. Así la app funciona igual en
 * cualquier tenant sin reconfigurar nada, y el DQL que se muestra en el panel
 * "Consulta que se ejecutó" no expone a qué environment pertenece.
 */
const environmentUrl = (): string => getEnvironmentUrl().replace(/\/+$/, "");

/* eslint-disable noSecrets/no-secrets -- rutas de apps Dynatrace, no son secretos */
/** Enlace al workload K8s en Smartscape (requiere el id del deployment). */
export const workloadUrl = (deploymentId: unknown): string | null =>
  typeof deploymentId === "string" && deploymentId
    ? `${environmentUrl()}/ui/apps/dynatrace.kubernetes/smartscape/workload/K8S_WORKLOAD` +
      `?detailsId=${encodeURIComponent(deploymentId)}` +
      `&sidebarOpen=false&perspective=Health&detailsTab=Overview`
    : null;

/** Enlace al servicio en la app clásica de servicios (requiere el id APM). */
export const serviceUrl = (serviceId: unknown): string | null =>
  typeof serviceId === "string" && serviceId
    ? `${environmentUrl()}/ui/apps/dynatrace.classic.services/ui/entity/${encodeURIComponent(serviceId)}`
    : null;

/* eslint-enable noSecrets/no-secrets */

/** Join del id de workload K8s (deployment/statefulset) en Smartscape. */
export const deploymentIdJoin = (sourceField: string): string => `| lookup [
    smartscapeNodes K8S_DEPLOYMENT, K8S_STATEFULSET
    | fields deployment_id = id, k8s.workload.name
    | limit 10000
  ], sourceField:${sourceField}, lookupField:\`k8s.workload.name\`, fields:{deployment_id}`;
