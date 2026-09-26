/**
 * Catálogo de buenas prácticas: la fuente única del estándar.
 *
 * Los módulos dicen QUÉ incumple cada workload; este catálogo dice POR QUÉ
 * importa y CÓMO se cumple. De aquí salen la Guía (M14), el "Why is this
 * flagged?" de cada fila y, en la Fase 5, los prompts de IA. Si una práctica
 * cambia, cambia aquí y en ningún otro lado.
 *
 * Escrito en inglés (decisión D1: el contenido nuevo no se traduce dos veces)
 * y para gente que no administra Kubernetes: cada término técnico se explica
 * la primera vez que aparece.
 *
 * Primera tanda: las 8 SPEC que mide M12 Cumplimiento, en su orden de
 * prioridad de remediación.
 */

export type Severity = "critical" | "high" | "medium" | "security" | "traceability";

export interface Practice {
  /** Estable: se usa en la URL (`/guide?focus=…`). */
  id: string;
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
    route: string;
    module: string;
    /** Cómo la detecta la app, para que el hallazgo sea verificable. */
    how: string;
  };
}

export const SEVERITY_META: Record<Severity, { label: string; meaning: string; order: number }> = {
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
  security: {
    label: "Security",
    meaning: "Doesn't affect availability; limits the damage of a compromise.",
    order: 3,
  },
  traceability: {
    label: "Traceability",
    meaning: "Doesn't affect availability; makes deployments reproducible and auditable.",
    order: 4,
  },
};

const M12 = { route: "/compliance", module: "Compliance (M12)" };

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
];

/** Prácticas por código del estándar ("SPEC06" → readiness-probe). */
export const practiceByCode = (code: string): Practice | undefined =>
  PRACTICES.find((p) => p.code === code);
