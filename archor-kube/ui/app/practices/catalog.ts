/**
 * Catálogo de buenas prácticas: la fuente única del estándar.
 *
 * Los módulos dicen QUÉ incumple cada workload; este catálogo dice POR QUÉ
 * importa y CÓMO se cumple. De aquí salen la Guía (M14), el "Why is this
 * flagged?" de cada fila y, en la Fase 5, los prompts de IA. Si una práctica
 * cambia, cambia aquí y en ningún otro lado.
 *
 * Bilingüe: el inglés vive aquí, junto a la estructura; el español en
 * `catalog.es.ts`, con una entrada obligatoria por práctica. Escrito para gente
 * que no administra Kubernetes: cada término técnico se explica la primera vez
 * que aparece.
 *
 * Primera tanda: las 8 SPEC que mide M12 Cumplimiento. Segunda tanda: las
 * reglas de criterio de los otros módulos (réplicas, HPA, estabilidad,
 * rightsizing, ociosos, huérfanos). El orden del arreglo es el de la Guía:
 * por severidad y, dentro de cada una, por prioridad de remediación.
 */

import type { Lang } from "../i18n";
import { PRACTICES_ES, SEVERITY_ES } from "./catalog.es";

export type Severity = "critical" | "high" | "medium" | "cost" | "security" | "traceability";

/** Los ids son un tipo cerrado para que cada traducción sea obligatoria. */
export type PracticeId =
  | "readiness-probe"
  | "liveness-probe"
  | "multiple-replicas"
  | "memory-limit"
  | "memory-request"
  | "autoscaler-headroom"
  | "stable-containers"
  | "cpu-limit"
  | "cpu-request"
  | "right-sized-requests"
  | "no-idle-workloads"
  | "non-root"
  | "helm-managed"
  | "owned-workloads";

export interface Practice {
  /** Estable: se usa en la URL (`/guide?focus=…`). */
  id: PracticeId;
  /** Código del estándar que mide la app, si lo hay. */
  code?: string;
  title: string;
  severity: Severity;
  /** Qué es, en una o dos frases sin jerga. */
  what: string;
  /** Por qué importa, en disponibilidad, plata o seguridad. */
  why: string;
  /** Qué pasa en la vida real cuando falta. */
  incident: string;
  /** Pasos para cumplirla. */
  howTo: string[];
  /** Manifiesto mínimo correcto. */
  yaml: string;
  /** Matiz que un SRE esperaría leer (trade-offs, errores comunes). */
  caveat?: string;
  /** Quién suele corregirla. */
  owner: string;
  measuredBy: {
    /** Ruta del módulo; su nombre visible sale del diccionario de navegación. */
    route:
      | "/compliance"
      | "/risk"
      | "/elasticity"
      | "/rightsizing"
      | "/idle"
      | "/orphans"
      | "/preventive";
    /** Código del módulo (M12…), igual en los dos idiomas. */
    code: string;
    /** Cómo la detecta la app, para que el hallazgo sea verificable. */
    how: string;
  };
}

/** El texto traducible de una práctica (lo demás es igual en los dos idiomas). */
export interface PracticeText {
  title: string;
  what: string;
  why: string;
  incident: string;
  howTo: string[];
  caveat?: string;
  owner: string;
  how: string;
}

const SEVERITY_EN: Record<Severity, { label: string; meaning: string; order: number }> = {
  critical: {
    label: "Critical",
    meaning: "Directly causes outages. Fix first.",
    order: 0,
  },
  high: {
    label: "High",
    meaning: "Causes crashes or evictions under load, often in other teams' pods.",
    order: 1,
  },
  medium: {
    label: "Medium",
    meaning: "Degrades latency or scheduling, but rarely takes a service down.",
    order: 2,
  },
  cost: {
    label: "Cost",
    meaning: "Doesn't affect availability; it's money paid for capacity nobody uses.",
    order: 3,
  },
  security: {
    label: "Security",
    meaning: "Doesn't affect availability; limits the damage of a compromise.",
    order: 4,
  },
  traceability: {
    label: "Traceability",
    meaning: "Doesn't affect availability; makes deployments reproducible and auditable.",
    order: 5,
  },
};

/** Orden de las severidades en la leyenda. */
export const SEVERITIES = Object.keys(SEVERITY_EN) as Severity[];

/** Etiqueta y significado de una severidad en el idioma pedido. */
export const severityText = (severity: Severity, lang: Lang) =>
  lang === "es" ? SEVERITY_ES[severity] : SEVERITY_EN[severity];

const M12 = { route: "/compliance", code: "M12" } as const;
const RISK = { route: "/risk", code: "M5" } as const;
const ELASTICITY = { route: "/elasticity", code: "M5" } as const;
const RIGHTSIZING = { route: "/rightsizing", code: "M1/M2" } as const;
const IDLE = { route: "/idle", code: "M3" } as const;
const ORPHANS = { route: "/orphans", code: "M6" } as const;
const PREVENTIVE = { route: "/preventive", code: "M8" } as const;

export const PRACTICES: Practice[] = [
  {
    id: "readiness-probe",
    code: "SPEC06",
    title: "Readiness probe",
    severity: "critical",
    what: "A check Kubernetes calls on each copy of your app (each pod) to ask: are you ready to receive traffic right now? Until it says yes, the pod gets no requests.",
    why: "Without it, Kubernetes sends traffic to a pod the moment its process starts, even if it is still loading configuration, warming caches or connecting to its database.",
    incident:
      "Every deployment and every restart produces a burst of 5xx errors and timeouts: users hit new pods that aren't ready yet, or old pods that are already shutting down.",
    howTo: [
      "Expose a lightweight endpoint (for example /ready) that answers 200 only when the app can actually serve requests.",
      "Configure readinessProbe on every container that receives traffic.",
      "Set initialDelaySeconds and periodSeconds from the app's real startup time, not from a template.",
    ],
    yaml: `containers:
  - name: app
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 10
      failureThreshold: 3`,
    caveat:
      "It's fine for readiness to check critical dependencies (a pod that can't reach its database shouldn't take traffic). That is exactly what liveness must NOT do.",
    owner: "The squad that owns the service",
    measuredBy: {
      ...M12,
      how: "Flags a workload when any of its containers has no readinessProbe in the pod spec.",
    },
  },
  {
    id: "liveness-probe",
    code: "SPEC05",
    title: "Liveness probe",
    severity: "critical",
    what: "A check Kubernetes calls to ask: are you still alive? If the answer is no several times in a row, Kubernetes restarts the container.",
    why: "A process can hang without crashing (a deadlock, an exhausted thread pool). Without liveness, Kubernetes sees it as running and never restarts it.",
    incident:
      "A silent outage: the pod shows as Running, monitoring sees no crash, and every request to that pod times out until someone restarts it by hand.",
    howTo: [
      "Expose an endpoint (for example /health) that checks only the process itself.",
      "Configure livenessProbe with a generous failureThreshold so a slow moment doesn't trigger a restart.",
      "For slow-starting apps, add a startupProbe so liveness doesn't kill the pod while it boots.",
    ],
    yaml: `containers:
  - name: app
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      periodSeconds: 15
      failureThreshold: 4
    startupProbe:
      httpGet:
        path: /health
        port: 8080
      periodSeconds: 5
      failureThreshold: 30`,
    caveat:
      "Never make liveness depend on a database or another service. If that dependency goes down, every pod fails liveness and restarts at once, turning a partial problem into a full outage.",
    owner: "The squad that owns the service",
    measuredBy: {
      ...M12,
      how: "Flags a workload when any of its containers has no livenessProbe in the pod spec.",
    },
  },
  {
    id: "multiple-replicas",
    title: "More than one replica",
    severity: "critical",
    what: "Running at least two copies (replicas) of the app at the same time, so one can go away while the other keeps serving.",
    why: "With a single replica, anything that stops that one pod stops the service: a crash, a deploy, or the platform team patching the node it runs on.",
    incident:
      "Routine node maintenance on a Tuesday night takes the service down for a few minutes. Nobody changed anything in the app, and it still shows up as an outage.",
    howTo: [
      "Set replicas to at least 2 for anything users or other services depend on.",
      "Add a PodDisruptionBudget so voluntary disruptions (node drains, upgrades) never take all replicas at once.",
      "Spread the replicas across nodes (topologySpreadConstraints) so one node failing doesn't take both.",
    ],
    yaml: `apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 2
---
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: my-service`,
    caveat:
      "Two replicas only help if both can take traffic: they need a readiness probe, and the app must not keep state in memory that the other copy lacks. Batch jobs and singletons (a scheduler that must run once) are legitimate exceptions.",
    owner: "The squad that owns the service",
    measuredBy: {
      ...RISK,
      how: "Flags Deployments and StatefulSets with replicas = 1 or no replicas set. The Risk module adds missing probes to the same score.",
    },
  },
  {
    id: "memory-limit",
    code: "SPEC02",
    title: "Memory limit",
    severity: "high",
    what: "The maximum memory a container may use. If it goes over, Kubernetes kills it (an OOMKill, out of memory).",
    why: "Without a limit, a memory leak in one app keeps growing until the whole machine (node) runs out, and the kernel starts killing processes, including other teams' apps.",
    incident:
      "The noisy neighbor: one service leaks memory at night and, by morning, unrelated pods on the same node have been killed or evicted. The team that gets paged isn't the one with the bug.",
    howTo: [
      "Look at the container's real memory usage over at least a week (the Rightsizing module shows it).",
      "Set limits.memory with headroom above the observed peak, typically 20–30%.",
      "If the container keeps getting OOMKilled, check for a leak before just raising the limit (the Preventive module shows OOM kills).",
    ],
    yaml: `containers:
  - name: app
    resources:
      requests:
        memory: "512Mi"
      limits:
        memory: "768Mi"`,
    caveat:
      "Unlike CPU, memory can't be throttled: going over the limit means being killed. Setting the memory limit equal to the request is a common, predictable choice.",
    owner: "The squad that owns the service",
    measuredBy: {
      ...M12,
      how: "Flags a workload when any of its containers has no resources.limits.memory.",
    },
  },
  {
    id: "memory-request",
    code: "SPEC04",
    title: "Memory request",
    severity: "high",
    what: "The memory a container reserves on the node. Kubernetes uses it to decide where the pod fits.",
    why: "Without a request, Kubernetes thinks the pod needs no memory and packs too many pods onto one node. They all fit on paper and run out of memory in practice.",
    incident:
      "Under peak load, nodes run out of memory and Kubernetes evicts pods to recover. Pods without a request are the first to go, often during the busiest hour.",
    howTo: [
      "Set requests.memory close to the container's typical usage, not its peak.",
      "Review it with the Rightsizing module: a request far above usage wastes money, one below usage risks evictions.",
    ],
    yaml: `containers:
  - name: app
    resources:
      requests:
        memory: "512Mi"`,
    owner: "The squad that owns the service",
    measuredBy: {
      ...M12,
      how: "Flags a workload when any of its containers has no resources.requests.memory.",
    },
  },
  {
    id: "autoscaler-headroom",
    title: "Autoscaler with room to grow",
    severity: "high",
    what: "When an app scales on its own (a HorizontalPodAutoscaler, HPA), its maximum number of replicas must leave room above what it normally uses.",
    why: "An autoscaler at its maximum can't add replicas when traffic grows. An autoscaler whose minimum equals its maximum never scales at all: it only looks like autoscaling.",
    incident:
      "A traffic peak arrives, the autoscaler wants more pods but is capped, and the existing ones saturate: latency climbs and requests start failing while the dashboard says autoscaling is on.",
    howTo: [
      "Set maxReplicas with real headroom above the usual peak, and check the cluster has capacity for it.",
      "Make minReplicas lower than maxReplicas; if the count should be fixed, remove the HPA and set replicas honestly.",
      "Review HPAs that sit at their maximum: either raise it or find out why the app needs so many pods.",
    ],
    yaml: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70`,
    caveat:
      "The HPA scales on usage relative to the request, so a wrong CPU request makes it scale too early or too late. Fix rightsizing first, then tune the HPA.",
    owner: "The squad that owns the service, with the platform team for cluster capacity",
    measuredBy: {
      ...ELASTICITY,
      how: "Flags HPAs whose ScalingLimited condition says TooManyReplicas (capped at the maximum) and HPAs where minReplicas equals maxReplicas.",
    },
  },
  {
    id: "stable-containers",
    title: "No OOM kills or restart loops",
    severity: "high",
    what: "Containers should stay up. An OOM kill means the container went over its memory limit and was killed; a restart loop means it keeps crashing and coming back.",
    why: "Each restart drops the requests in flight and, while the pod is down, the remaining replicas carry its load. Repeated restarts are also the earliest warning of a bigger outage.",
    incident:
      "A service restarts a few times a day and nobody notices, until a traffic peak makes all its replicas restart at the same time.",
    howTo: [
      "For OOM kills, compare memory usage with the limit: if usage climbs steadily until the kill, it's a leak; if it's only a peak, raise the limit.",
      "For restart loops, read the logs of the previous container to see why it exits.",
      "Check the liveness probe: a probe that's too strict restarts healthy containers.",
    ],
    yaml: `# The previous container's logs explain most restart loops
kubectl logs <pod> -c <container> --previous -n <namespace>

# Last termination reason (OOMKilled, Error, ...)
kubectl get pod <pod> -n <namespace> -o jsonpath="{.status.containerStatuses[*].lastState.terminated.reason}"`,
    caveat:
      "Raising the memory limit makes an OOM kill go away today; if the cause is a leak, it comes back later and bigger. Look at the memory trend before changing the number.",
    owner: "The squad that owns the service",
    measuredBy: {
      ...PREVENTIVE,
      how: "Flags workloads with, in the last 24 hours, any OOM kill, more than 10 restarts (a loop) or more than 3 restarts (elevated).",
    },
  },
  {
    id: "cpu-limit",
    code: "SPEC01",
    title: "CPU limit",
    severity: "medium",
    what: "The maximum CPU a container may use. Going over doesn't kill it: Kubernetes slows it down (throttling).",
    why: "Without a limit, one busy container can take all the CPU on a node and slow down every other pod there.",
    incident:
      "Latency spikes in services that did nothing wrong: they share a node with a batch job or a runaway loop that grabbed every core.",
    howTo: [
      "Set limits.cpu well above the request, so normal bursts aren't throttled.",
      "Watch throttling in the Bottlenecks module after setting it: sustained throttling means the limit is too low.",
    ],
    yaml: `containers:
  - name: app
    resources:
      requests:
        cpu: "250m"
      limits:
        cpu: "1"`,
    caveat:
      "CPU limits are debated in the Kubernetes community: a limit that's too tight throttles your own app even when the node has spare CPU. This standard requires one, so set it generously and let the Bottlenecks module tell you if it bites.",
    owner: "The squad that owns the service",
    measuredBy: {
      ...M12,
      how: "Flags a workload when any of its containers has no resources.limits.cpu.",
    },
  },
  {
    id: "cpu-request",
    code: "SPEC03",
    title: "CPU request",
    severity: "medium",
    what: "The CPU a container reserves on the node (250m means a quarter of a core). Kubernetes uses it to place the pod and to share CPU fairly under contention.",
    why: "Without a request, the pod gets the lowest priority when CPU is scarce and Kubernetes can place it on a node that's already full.",
    incident:
      "The service works fine at low traffic and becomes slow exactly when load rises, because it's the first to lose CPU to its neighbors.",
    howTo: [
      "Set requests.cpu near the container's typical usage.",
      "Use the Rightsizing module to adjust it: a large gap between request and usage is money reserved and never used.",
    ],
    yaml: `containers:
  - name: app
    resources:
      requests:
        cpu: "250m"`,
    owner: "The squad that owns the service",
    measuredBy: {
      ...M12,
      how: "Flags a workload when any of its containers has no resources.requests.cpu.",
    },
  },
  {
    id: "right-sized-requests",
    title: "Requests close to real usage",
    severity: "medium",
    what: "What a container reserves (its requests) should be close to what it actually uses. Kubernetes places pods by what they reserve, not by what they use.",
    why: "Reserving far more than you use leaves node capacity blocked and paid for, but idle. Reserving less than you use packs too many pods on a node, and they fight for CPU and memory.",
    incident:
      "The cluster keeps adding nodes because it looks full, while real usage sits at a fraction of it. The bill grows every month and nothing is busier.",
    howTo: [
      "Look at real usage in the Rightsizing module before changing anything.",
      "Set requests near typical usage and leave the peaks to the limits.",
      "If CPU throttling is high, raise the CPU limit (or the request) before touching anything else.",
      "Change a few workloads at a time and watch latency.",
    ],
    yaml: `containers:
  - name: app
    resources:
      requests:
        cpu: "200m"      # close to typical usage
        memory: "384Mi"
      limits:
        cpu: "1"         # room for bursts
        memory: "512Mi"`,
    caveat:
      "The Rightsizing module looks at a short window. Month-end closes, campaigns or batch windows can need much more than a normal day shows, so check the history before cutting.",
    owner: "The squad that owns the service, with FinOps to prioritize",
    measuredBy: {
      ...RIGHTSIZING,
      how: "Lists pods with more than 40% of the CPU or memory request unused, usage above the request (under-provisioned) or CPU throttling above 25%. From 70% unused it marks them over-provisioned; between 40% and 70%, it marks them as to review.",
    },
  },
  {
    id: "no-idle-workloads",
    title: "Scale down what nobody uses",
    severity: "cost",
    what: "A workload with no traffic and no activity for a week should be scaled to zero or removed, not left running.",
    why: "An idle workload still reserves CPU and memory on the nodes, and that reservation is paid for every hour, whether anyone calls it or not.",
    incident:
      "An old version of a service, a finished experiment or a forgotten test environment keeps running for months. Each one is small; together they are whole nodes the company pays for.",
    howTo: [
      "Confirm it's really idle: no business traffic in a week, and not crashing (a broken service also looks quiet).",
      "Ask the owning squad: some services only work at month-end or during a yearly process.",
      "Scale it to zero first and delete it later, so it can come back quickly if someone needed it.",
      "For services with irregular traffic, use scale-to-zero autoscaling (for example KEDA) instead of keeping replicas up.",
    ],
    yaml: `# Scale to zero first; delete only after confirming nobody misses it
kubectl scale deployment <workload> --replicas=0 -n <namespace>`,
    caveat:
      "Low CPU alone isn't idle: an efficient service can serve thousands of requests with almost no CPU. ArchorKube only confirms idle when traffic, stability and CPU agree.",
    owner: "The squad that owns the service, with FinOps",
    measuredBy: {
      ...IDLE,
      how: "Confirms idle only when all three hold for 7 days: 10 or fewer APM requests, no OOM kills or restart loops, and near-zero CPU (average under 5 mc and peak under 20 mc).",
    },
  },
  {
    id: "non-root",
    code: "SPEC07",
    title: "Run as non-root",
    severity: "security",
    what: "The container's process runs as a regular user, not as root (the administrator).",
    why: "If an attacker gets into a container running as root, it's much easier to escape to the node and reach everything else running there.",
    incident:
      "A vulnerability in one public-facing service becomes a compromise of the whole node, and of every other team's pods on it.",
    howTo: [
      "Build the image with a non-root user (a USER line in the Dockerfile).",
      "Set runAsNonRoot: true so Kubernetes refuses to start the container if it would run as root.",
      "Add allowPrivilegeEscalation: false while you're there.",
    ],
    yaml: `containers:
  - name: app
    securityContext:
      runAsNonRoot: true
      runAsUser: 10001
      allowPrivilegeEscalation: false`,
    owner: "The squad that owns the service, with the platform or security team",
    measuredBy: {
      ...M12,
      how: "Flags a workload when a container runs as user 0 or has no runAsUser, and runAsNonRoot isn't true.",
    },
  },
  {
    id: "helm-managed",
    code: "SPEC08",
    title: "Deployed with Helm",
    severity: "traceability",
    what: "The workload was installed with Helm, a tool that deploys Kubernetes apps from versioned templates.",
    why: "A workload created by hand (or left over from an old setup) has no source anyone can review: you can't tell what changed, redeploy it the same way, or roll it back cleanly.",
    incident:
      "After an incident nobody can say which version is running or who changed its limits. The fix is applied by hand again, and the next deploy undoes it.",
    howTo: [
      "Move the workload's manifests into a Helm chart in a repository.",
      "Deploy it through the pipeline, never with kubectl apply from a laptop.",
      "Helm adds the label app.kubernetes.io/managed-by: Helm by itself; that's what the app checks.",
    ],
    yaml: `metadata:
  labels:
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/name: my-service
    app.kubernetes.io/version: "1.4.2"`,
    caveat:
      "Workloads deployed by other declarative tools (Argo CD, Flux, Kustomize) show up here as not compliant. If that's your standard, treat this spec as 'is it deployed from a repository?'.",
    owner: "The squad that owns the service, with the platform team",
    measuredBy: {
      ...M12,
      how: "Flags a workload when its Deployment/StatefulSet/DaemonSet/Job doesn't carry the label app.kubernetes.io/managed-by = Helm.",
    },
  },
  {
    id: "owned-workloads",
    title: "Every workload has an owner and a reason to exist",
    severity: "traceability",
    what: "Every workload in the cluster should be registered to a squad in the ownership catalog, and anything scaled to zero for good should be removed.",
    why: "A workload without an owner has nobody to call when it breaks and nobody to decide whether it's still needed. A workload left at zero replicas is noise that hides what's really running.",
    incident:
      "An alert fires on a service nobody recognizes. The on-call engineer spends an hour finding out who owns it, and in the end nobody does.",
    howTo: [
      "Register the workload in the ownership catalog with its squad and app code, using the same name it has in the cluster.",
      "Add ownership labels to the manifest as a fallback.",
      "For workloads at zero replicas, confirm with the owner and delete the manifest if it's no longer needed.",
    ],
    yaml: `metadata:
  labels:
    app.kubernetes.io/name: my-service
    app.kubernetes.io/part-of: payments   # the product
    team: data-ninjas                      # the owning squad`,
    caveat:
      "A workload can look ownerless only because its name in the catalog differs from its name in the cluster. Check the name before assuming it's abandoned.",
    owner: "The platform team, with each squad keeping its catalog entries current",
    measuredBy: {
      ...ORPHANS,
      how: "Flags Deployments and StatefulSets scaled to 0 replicas, and running workloads whose name matches no squad or app code in the ownership catalog.",
    },
  },
];

/** El texto de una práctica en el idioma pedido. */
export const practiceText = (practice: Practice, lang: Lang): PracticeText =>
  lang === "es"
    ? PRACTICES_ES[practice.id]
    : {
        title: practice.title,
        what: practice.what,
        why: practice.why,
        incident: practice.incident,
        howTo: practice.howTo,
        caveat: practice.caveat,
        owner: practice.owner,
        how: practice.measuredBy.how,
      };

/** Prácticas por código del estándar ("SPEC06" → readiness-probe). */
export const practiceByCode = (code: string): Practice | undefined =>
  PRACTICES.find((p) => p.code === code);
