/**
 * Textos de la interfaz. `es` tiene el mismo tipo que `en`, así que si falta
 * una clave en español el build no pasa. Las funciones son para textos con
 * valores adentro.
 */
export const en = {
  nav: {
    "/rightsizing": {
      label: "Rightsizing",
      tooltip: "Modules 1 and 2 (M1/M2) — CPU and memory rightsizing: what each workload reserves",
    },
    "/idle": {
      label: "Idle",
      tooltip:
        "Module 3 (M3) — Idle: workloads with no traffic or activity, candidates to turn off",
    },
    "/nodes": {
      label: "Nodes",
      tooltip: "Module 4 (M4) — Density: pods per node and nodes that could be consolidated",
    },
    "/risk": {
      label: "Risk",
      tooltip: "Module 5 (M5) — Outage risk: single replica and missing health checks",
    },
    "/elasticity": {
      label: "Elasticity",
      tooltip: "Module 5 (M5) — Outage risk, autoscaling angle: HPAs capped or without headroom",
    },
    "/orphans": {
      label: "Orphans",
      tooltip: "Module 6 (M6) — Orphans: workloads with no replicas or no owner in the catalog",
    },
    "/tiers": {
      label: "Tiers",
      tooltip:
        "Module 7 (M7) — Tiering: the ownership catalog that prioritizes every other finding",
    },
    "/tier-pending": {
      label: "Pending",
      tooltip: "Module 7 (M7) — Pending tiers: workloads without a declared tier, by squad",
    },
    "/preventive": {
      label: "Preventive",
      tooltip: "Module 8 (M8) — Early detection: OOM kills and restart loops",
    },
    "/errors": {
      label: "Errors",
      tooltip: "Module 9 (M9) — Critical errors: errors and fatals in the logs, by container",
    },
    "/control-plane": {
      label: "Control plane",
      tooltip: "Module 10 (M10) — Control plane: node health and active conditions",
    },
    "/bottlenecks": {
      label: "Bottlenecks",
      tooltip: "Module 11 (M11) — Bottlenecks: CPU throttling and node saturation",
    },
    "/compliance": {
      label: "Compliance",
      tooltip: "Module 12 (M12) — Compliance with the AKS standard: the 8 best-practice SPECs",
    },
    "/spend": {
      label: "Spend",
      tooltip: "Module 13 (M13) — Infrastructure spend: which machines, what type and since when",
    },
    "/guide": {
      label: "Guide",
      tooltip: "Module 14 (M14) — Best practices guide: why each rule exists and how to comply",
    },
  },
  header: {
    logoTitle:
      "ArchorKube — from arch (architecture) and archon, the Greek arkhon who governed and orchestrated the state, on Kubernetes: the layer that gives every finding an owner and a priority.",
    setup: "Setup",
    settings: "Settings",
    help: "Help",
  },
  notice: {
    eyebrow: "IMPORTANT NOTICE",
    title: "Unofficial community app",
    notOfficialLead: "ArchorKube is",
    notOfficialStrong: "not an official Dynatrace app",
    notOfficialRest: ", and you can't open a Dynatrace support ticket for it.",
    reportIssues: "You can report issues on the GitHub repository:",
    fork: "Feel free to fork it for your own use.",
    data: "ArchorKube only reads data from your tenant. When you send a finding to an AI outside Dynatrace, only what you see in the preview leaves, filtered first.",
    dontShow: "Don't show this again",
    continue: "Continue",
  },
  settings: {
    title: "Settings",
    saved: "Saved",
    saveFailed: "Could not save the setting",
    languageTitle: "Language",
    languageHint: "Saved for your user in this tenant. English is the default.",
    aiTitle: "Sending to AI",
    aiIntroStrong: "Dynatrace Assist",
    aiIntroRest:
      " always gets the full finding: it runs inside your tenant. Every AI outside Dynatrace (your local Ollama, or Claude, Gemini, ChatGPT and others through the clipboard) gets the finding through a data filter first, and you see a preview of exactly what leaves before it does.",
    modeLabel: "How Kubernetes names leave Dynatrace",
    modePlaceholders: "Placeholders (recommended)",
    modePlaceholdersHint:
      "Names go out as $NS, $WL, $POD, $CONTAINER. The AI writes commands with those variables and you fill them in your terminal.",
    modeReal: "Real Kubernetes names",
    modeRealHint:
      "Namespace, workload, pod and container go out as they are. The preview warns you every time.",
    modeSaveFailedHint: "Placeholders stay on until it can be saved.",
    neverLeaves: "Never leaves, in either mode",
    neverLeavesItems: [
      "The cluster name (sent as <kube-context>)",
      "Squad, tribe and app code",
      "Costs in USD",
      "Tenant URLs and entity IDs",
      "IP addresses and emails found in log messages",
    ],
    savedForUser: "Saved for your user in this tenant. Nobody else sees it.",
    bridgeTitle: "Local Ollama bridge",
    bridgeIntro:
      "Dynatrace apps can't connect to your machine, so ArchorKube opens a small page that runs locally and talks to Ollama for you.",
    bridgeHowTo: "How to start it",
    bridgeUrl: "Bridge URL",
    save: "Save",
    bridgeInvalid: "That is not an http(s) URL",
    bridgeSaved: "Bridge URL saved in this browser",
    bridgeHint: (defaultUrl: string) =>
      `Stored only in this browser. Leave it empty to use ${defaultUrl}.`,
  },
  rowMenu: {
    ariaLabel: "Row actions",
    whyFlagged: "Why is this flagged?",
    askAssist: "Ask Dynatrace Assist",
    sendOllama: "Send to local Ollama…",
    copyForAi: "Copy for another AI…",
  },
  send: {
    ollamaTitle: "Send to local Ollama",
    ollamaAction: "Send",
    ollamaTarget: "your local Ollama",
    clipboardTitle: "Copy for another AI",
    clipboardAction: "Copy to clipboard",
    clipboardTarget: "the clipboard, to paste in Claude, Gemini, ChatGPT or any other AI",
    cancel: "Cancel",
    realTitle: "Real Kubernetes names",
    realBody:
      "This text has the real namespace, workload, pod and container names. To send placeholders instead, change it in Settings.",
    exactlyLead: "This is",
    exactlyStrong: "exactly",
    exactlyRest: (target: string) => ` what goes to ${target}. You can edit it before it leaves.`,
    removed: (items: string) =>
      `Removed or replaced: ${items}. Never sent: cluster name, owners, costs, tenant links, IPs and emails.`,
    copied: "Copied",
    copiedBody: "Paste it in any AI. Only what you saw in the preview was copied.",
    copyFailed: "Could not copy",
    blocked: "The browser blocked the window",
    blockedBody: "Allow pop-ups for this page and try again.",
    noAnswer: "The bridge did not answer",
    noAnswerBody: "Start it with: python -m http.server 8765 (in tools/ollama-bridge).",
  },
  guide: {
    title: "Kubernetes best practices",
    introWhat: "what",
    introWhy: "why each rule exists",
    introHow: "how to comply",
    intro: (what: string, why: string, how: string) => [
      "The other tabs tell you ",
      what,
      " is out of standard. This one explains ",
      why,
      " and ",
      how,
      ", in plain words. A rule people understand gets fixed; a red cell nobody can explain gets ignored.",
    ],
    flaggedTitle: (workload: string) => `Why is ${workload} flagged?`,
    flaggedBody: (count: number) =>
      `It doesn't meet ${count === 1 ? "this practice" : "these practices"}. They are open below, ordered by what to fix first.`,
    severityLegend: "How to read the severity",
    whatItIs: "What it is",
    whyItMatters: "Why it matters",
    withoutIt: "What happens without it",
    howToComply: "How to comply",
    worthKnowing: "Worth knowing",
    howMeasured: "How ArchorKube measures it",
    seeItIn: (module: string) => `See it in ${module}`,
    whoFixes: "Who usually fixes it",
  },
  setup: {
    title: "Setup",
    intro:
      "What ArchorKube needs from your tenant and your installation files, and which module stops working when something is missing. Every check is a read-only query.",
    status: { ok: "OK", warn: "Needs attention", fail: "Not working", info: "Optional" },
    running: "Running",
    affects: (modules: string) => `Affects: ${modules}`,
    howToFix: "How to fix",
    checking: "Checking…",
    runAgain: "Run again",
    missingPermission: (message: string) => `Missing permission: ${message}`,
    checkFailed: (message: string) => `The check failed: ${message}`,
  },
  module: {
    details: "Details",
    aboutTitle: "About this module",
    close: "Close",
    refresh: "Refresh",
    loadingSummary: "Loading summary",
    loadingDetail: "Loading detail",
    dqlError: "DQL error:",
    all: "All",
    ofTotal: (total: number) => ` (of ${total})`,
    queriedAt: (clock: string) => `queried ${clock}`,
    simpleTitle: "In plain words",
    simpleWhat: "What am I looking at?",
    simpleWhy: "Why should I care?",
    simpleAction: "What do I do with this?",
    windowTitle: "Analysis window",
    glossaryTitle: "Glossary: what does each term mean?",
    dqlTitle: "Query that ran (for the technical team)",
    dqlHint:
      "This is the exact DQL that produced the tables above, with your current filters applied. You can copy it and run it in a Dynatrace notebook to check any number.",
    glossary: [
      {
        term: "Cluster",
        meaning:
          "The set of machines where the applications run. There can be several (for example one for production and one for non-production).",
      },
      {
        term: "Node",
        meaning:
          "One of those machines (a server). The cluster spreads the applications across its nodes.",
      },
      {
        term: "Pod",
        meaning:
          "A running copy of an application. If an application has 3 copies to handle the load, those are 3 pods.",
      },
      {
        term: "Workload",
        meaning:
          "The application itself, with all its copies. It's what a squad recognizes as 'its service'.",
      },
      {
        term: "Namespace",
        meaning:
          "A folder inside the cluster that groups related applications and keeps them apart from the rest.",
      },
      {
        term: "Request (reservation)",
        meaning:
          "The CPU and memory the application asks to have reserved for itself. It's paid for whether it's used or not: it's the basis of the waste calculation.",
      },
      {
        term: "Limit (cap)",
        meaning:
          "The most CPU and memory the application may use. If it hits it, the system slows it down or restarts it.",
      },
      {
        term: "Throttling (slowdown)",
        meaning:
          "When an application asks for more CPU than its cap allows, the system slows it down on purpose. End users feel it as slowness.",
      },
      {
        term: "OOM kill",
        meaning:
          "The system kills the application because it ran out of memory. It goes down and starts again, losing whatever it was doing.",
      },
      {
        term: "Probe (health check)",
        meaning:
          "An automatic check that asks 'are you still alive?' and 'can you take requests yet?'. Without it, the system sends traffic to copies that don't answer.",
      },
      {
        term: "Replica",
        meaning:
          "Each copy of the application. With only one, any failure takes it out of service; with several, the others keep serving.",
      },
      {
        term: "HPA (autoscaling)",
        meaning:
          "The mechanism that adds or removes copies on its own, based on load. Once it reaches its maximum, it can't grow any more even if it's needed.",
      },
      {
        term: "Tier",
        meaning:
          "How critical the application is for the business, according to the ownership catalog. Tier 1 is the most critical.",
      },
      {
        term: "Squad / Tribe",
        meaning:
          "The team that owns the application and the area it belongs to. It tells you whose job it is to act.",
      },
      {
        term: "Grail / DQL",
        meaning:
          "Grail is the Dynatrace database where everything observed is stored, and DQL is the language used to query it. Every number in this app comes from a live DQL query.",
      },
    ],
    filters: {
      cluster: "Cluster",
      clusterAll: "Cluster: all",
      namespace: "Namespace",
      namespaceAll: "Namespace: all",
      tier: "Tier",
      tierAll: "Tier: all",
      tribu: "Tribe",
      tribuAll: "Tribe: all",
      squad: "Squad",
      squadAll: "Squad: all",
      extraAll: (label: string) => `${label}: all`,
    },
  },
  chart: {
    groupBy: "Group by",
    loading: "Loading chart",
    loadingTrend: "Loading node trend",
    noData: "(no data)",
    noCluster: "(no cluster)",
    noNode: "(no node)",
    noTier: "(no tier)",
    dqlError: "DQL error:",
    dimension: {
      tier: "Tier",
      squad: "Squad",
      tribu: "Tribe",
      rango_mem: "Reserved memory range",
      uso_vs_reserva: "Usage vs. reservation",
    } as Record<string, string>,
    by: (noun: string, dimension: string) => `${noun} by ${dimension.toLowerCase()}`,
    nouns: {
      verdicts: "Verdicts",
      criticality: "Criticality",
      elasticity: "Elasticity",
      severity: "Severity",
      orphans: "Orphans",
      signals: "Signals",
      problems: "Problems",
      risk: "Risk",
    },
    axis: {
      workloads: "Workloads",
      pods: "Pods",
      hpas: "HPAs",
      containers: "Containers",
      nodes: "Nodes",
      node: "Node",
      cluster: "Cluster",
      hostUsage: "% host usage",
      repos: "Repos",
      tier: "Tier",
    },
    nodesByAction: "Nodes by action and cluster",
    noSaturation: "No node is above 80% of host CPU or memory.",
    saturationTitle: "Node saturation (host CPU/MEM > 80%)",
    nodeHealthTitle: "Node health by cluster",
    reposByTier: "Repositories by tier",
    activeNodesPerDay: "Active nodes per day (30 days)",
    spendGrowing: "is spend growing?",
  },
};

export type UiText = typeof en;

export const es: UiText = {
  nav: {
    "/rightsizing": {
      label: "Rightsizing",
      tooltip:
        "Módulos 1 y 2 (M1/M2) — Rightsizing de CPU y memoria: ajuste de lo que cada workload reserva",
    },
    "/idle": {
      label: "Ociosos",
      tooltip: "Módulo 3 (M3) — Ociosos: workloads sin tráfico ni actividad, candidatos a apagar",
    },
    "/nodes": {
      label: "Nodos",
      tooltip: "Módulo 4 (M4) — Densidad: pods por nodo y nodos candidatos a consolidar",
    },
    "/risk": {
      label: "Riesgo",
      tooltip: "Módulo 5 (M5) — Riesgo de caída: réplica única y chequeos de salud faltantes",
    },
    "/elasticity": {
      label: "Elasticidad",
      tooltip: "Módulo 5 (M5) — Riesgo de caída, ángulo de autoescalado: HPAs topados o sin margen",
    },
    "/orphans": {
      label: "Huérfanos",
      tooltip: "Módulo 6 (M6) — Huérfanos: workloads sin réplicas o sin dueño en el catálogo",
    },
    "/tiers": {
      label: "Tiers",
      tooltip:
        "Módulo 7 (M7) — Tieraje: el catálogo de propiedad que prioriza los hallazgos de todos los demás",
    },
    "/tier-pending": {
      label: "Pendientes",
      tooltip:
        "Módulo 7 (M7) — Pendientes de tieraje: workloads sin tier declarado, repartidos por squad",
    },
    "/preventive": {
      label: "Preventiva",
      tooltip: "Módulo 8 (M8) — Detección preventiva: OOM kills y bucles de reinicio",
    },
    "/errors": {
      label: "Errores",
      tooltip: "Módulo 9 (M9) — Errores críticos: errores y fatales en los logs, por contenedor",
    },
    "/control-plane": {
      label: "Control plane",
      tooltip: "Módulo 10 (M10) — Control plane: salud de los nodos y condiciones activas",
    },
    "/bottlenecks": {
      label: "Cuellos de botella",
      tooltip: "Módulo 11 (M11) — Cuellos de botella: throttling de CPU y saturación de nodos",
    },
    "/compliance": {
      label: "Cumplimiento",
      tooltip: "Módulo 12 (M12) — Cumplimiento del estándar AKS: las 8 SPECs de buenas prácticas",
    },
    "/spend": {
      label: "Gasto",
      tooltip:
        "Módulo 13 (M13) — Gasto de infraestructura: qué máquinas hay, de qué tipo y desde cuándo",
    },
    "/guide": {
      label: "Guía",
      tooltip:
        "Módulo 14 (M14) — Guía de buenas prácticas: por qué existe cada regla y cómo cumplirla",
    },
  },
  header: {
    logoTitle:
      "ArchorKube — de arch (arquitectura) y arconte, el arkhon griego que gobernaba y orquestaba el estado, sobre Kubernetes: la capa que le pone dueño y prioridad a cada hallazgo.",
    setup: "Setup",
    settings: "Configuración",
    help: "Ayuda",
  },
  notice: {
    eyebrow: "AVISO IMPORTANTE",
    title: "App comunitaria no oficial",
    notOfficialLead: "ArchorKube",
    notOfficialStrong: "no es una app oficial de Dynatrace",
    notOfficialRest: " y no admite tickets de soporte de Dynatrace.",
    reportIssues: "Puedes reportar problemas en el repositorio de GitHub:",
    fork: "Puedes hacer fork para tu propio uso.",
    data: "ArchorKube solo lee datos de tu tenant. Cuando envías un hallazgo a una IA fuera de Dynatrace, solo sale lo que ves en la vista previa, y ya filtrado.",
    dontShow: "No volver a mostrar",
    continue: "Continuar",
  },
  settings: {
    title: "Configuración",
    saved: "Guardado",
    saveFailed: "No se pudo guardar la configuración",
    languageTitle: "Idioma",
    languageHint: "Se guarda para tu usuario en este tenant. El idioma por defecto es inglés.",
    aiTitle: "Envío a IA",
    aiIntroStrong: "Dynatrace Assist",
    aiIntroRest:
      " siempre recibe el hallazgo completo: corre dentro de tu tenant. Toda IA fuera de Dynatrace (tu Ollama local, o Claude, Gemini, ChatGPT y otras por el portapapeles) recibe el hallazgo después de pasar por un filtro de datos, y antes de que salga ves una vista previa de exactamente lo que se envía.",
    modeLabel: "Cómo salen de Dynatrace los nombres de Kubernetes",
    modePlaceholders: "Placeholders (recomendado)",
    modePlaceholdersHint:
      "Los nombres salen como $NS, $WL, $POD, $CONTAINER. La IA arma los comandos con esas variables y tú las completas en tu terminal.",
    modeReal: "Nombres reales de Kubernetes",
    modeRealHint:
      "Namespace, workload, pod y container salen tal cual. La vista previa te lo advierte cada vez.",
    modeSaveFailedHint: "Los placeholders siguen activos hasta que se pueda guardar.",
    neverLeaves: "Nunca sale, en ningún modo",
    neverLeavesItems: [
      "El nombre del cluster (sale como <kube-context>)",
      "Squad, tribu y app code",
      "Costos en USD",
      "URLs del tenant e IDs de entidades",
      "Direcciones IP y emails que aparezcan en mensajes de log",
    ],
    savedForUser: "Se guarda para tu usuario en este tenant. Nadie más lo ve.",
    bridgeTitle: "Puente local a Ollama",
    bridgeIntro:
      "Las apps de Dynatrace no pueden conectarse a tu máquina, así que ArchorKube abre una página pequeña que corre en tu equipo y habla con Ollama por ti.",
    bridgeHowTo: "Cómo levantarlo",
    bridgeUrl: "URL del puente",
    save: "Guardar",
    bridgeInvalid: "Eso no es una URL http(s)",
    bridgeSaved: "URL del puente guardada en este navegador",
    bridgeHint: (defaultUrl: string) =>
      `Se guarda solo en este navegador. Déjala vacía para usar ${defaultUrl}.`,
  },
  rowMenu: {
    ariaLabel: "Acciones de la fila",
    whyFlagged: "¿Por qué se marca?",
    askAssist: "Preguntar a Dynatrace Assist",
    sendOllama: "Enviar a Ollama local…",
    copyForAi: "Copiar para otra IA…",
  },
  send: {
    ollamaTitle: "Enviar a Ollama local",
    ollamaAction: "Enviar",
    ollamaTarget: "tu Ollama local",
    clipboardTitle: "Copiar para otra IA",
    clipboardAction: "Copiar al portapapeles",
    clipboardTarget: "el portapapeles, para pegarlo en Claude, Gemini, ChatGPT u otra IA",
    cancel: "Cancelar",
    realTitle: "Nombres reales de Kubernetes",
    realBody:
      "Este texto tiene los nombres reales de namespace, workload, pod y container. Para enviar placeholders, cámbialo en Configuración.",
    exactlyLead: "Esto es",
    exactlyStrong: "exactamente",
    exactlyRest: (target: string) => ` lo que va a ${target}. Puedes editarlo antes de que salga.`,
    removed: (items: string) =>
      `Quitado o reemplazado: ${items}. Nunca se envía: nombre del cluster, dueños, costos, links del tenant, IPs ni emails.`,
    copied: "Copiado",
    copiedBody: "Pégalo en cualquier IA. Solo se copió lo que viste en la vista previa.",
    copyFailed: "No se pudo copiar",
    blocked: "El navegador bloqueó la ventana",
    blockedBody: "Permite las ventanas emergentes para esta página y vuelve a intentarlo.",
    noAnswer: "El puente no respondió",
    noAnswerBody: "Levántalo con: python -m http.server 8765 (en tools/ollama-bridge).",
  },
  guide: {
    title: "Buenas prácticas de Kubernetes",
    introWhat: "qué",
    introWhy: "por qué existe cada regla",
    introHow: "cómo cumplirla",
    intro: (what: string, why: string, how: string) => [
      "Las otras pestañas te dicen ",
      what,
      " está fuera del estándar. Esta explica ",
      why,
      " y ",
      how,
      ", en palabras simples. Una regla que la gente entiende se corrige; una celda roja que nadie sabe explicar se ignora.",
    ],
    flaggedTitle: (workload: string) => `¿Por qué se marca ${workload}?`,
    flaggedBody: (count: number) =>
      `No cumple ${count === 1 ? "esta práctica" : "estas prácticas"}. Están abiertas abajo, en el orden en que conviene corregirlas.`,
    severityLegend: "Cómo leer la severidad",
    whatItIs: "Qué es",
    whyItMatters: "Por qué importa",
    withoutIt: "Qué pasa sin ella",
    howToComply: "Cómo cumplirla",
    worthKnowing: "Para tener en cuenta",
    howMeasured: "Cómo la mide ArchorKube",
    seeItIn: (module: string) => `Verla en ${module}`,
    whoFixes: "Quién suele corregirla",
  },
  setup: {
    title: "Setup",
    intro:
      "Qué necesita ArchorKube de tu tenant y de tus archivos de instalación, y qué módulo deja de funcionar cuando algo falta. Cada chequeo es una consulta de solo lectura.",
    status: { ok: "OK", warn: "Requiere atención", fail: "No funciona", info: "Opcional" },
    running: "Ejecutando",
    affects: (modules: string) => `Afecta a: ${modules}`,
    howToFix: "Cómo arreglarlo",
    checking: "Revisando…",
    runAgain: "Volver a revisar",
    missingPermission: (message: string) => `Falta un permiso: ${message}`,
    checkFailed: (message: string) => `El chequeo falló: ${message}`,
  },
  module: {
    details: "Detalles",
    aboutTitle: "Acerca de este módulo",
    close: "Cerrar",
    refresh: "Actualizar",
    loadingSummary: "Cargando resumen",
    loadingDetail: "Cargando detalle",
    dqlError: "Error DQL:",
    all: "Todos",
    ofTotal: (total: number) => ` (de ${total})`,
    queriedAt: (clock: string) => `consultado ${clock}`,
    simpleTitle: "En palabras simples",
    simpleWhat: "¿Qué estoy viendo?",
    simpleWhy: "¿Por qué me importa?",
    simpleAction: "¿Qué hago con esto?",
    windowTitle: "Ventana de análisis",
    glossaryTitle: "Glosario: ¿qué significa cada término?",
    dqlTitle: "Consulta que se ejecutó (para el equipo técnico)",
    dqlHint:
      "Este es el DQL exacto que produjo las tablas de arriba, con los filtros que tengas puestos ya aplicados. Puedes copiarlo y ejecutarlo en un notebook de Dynatrace para verificar cualquier número.",
    glossary: [
      {
        term: "Clúster",
        meaning:
          "El conjunto de máquinas donde corren las aplicaciones. Puede haber varios (por ejemplo uno de producción y otro de no-producción).",
      },
      {
        term: "Nodo",
        meaning:
          "Una de esas máquinas (un servidor). El clúster reparte las aplicaciones entre sus nodos.",
      },
      {
        term: "Pod",
        meaning:
          "Una copia en ejecución de una aplicación. Si una aplicación tiene 3 copias para aguantar la carga, son 3 pods.",
      },
      {
        term: "Workload",
        meaning:
          "La aplicación como tal, con todas sus copias. Es lo que un squad reconoce como 'su servicio'.",
      },
      {
        term: "Namespace",
        meaning:
          "Una carpeta dentro del clúster que agrupa aplicaciones relacionadas y las mantiene separadas de las demás.",
      },
      {
        term: "Request (reserva)",
        meaning:
          "La cantidad de CPU y memoria que la aplicación pide reservada para sí. Se paga se use o no: es la base del cálculo de desperdicio.",
      },
      {
        term: "Limit (tope)",
        meaning:
          "El máximo de CPU y memoria que la aplicación puede llegar a usar. Si lo toca, el sistema la frena o la reinicia.",
      },
      {
        term: "Throttling (frenado)",
        meaning:
          "Cuando una aplicación pide más CPU de la que su tope permite, el sistema la ralentiza a propósito. Se siente como lentitud para el usuario final.",
      },
      {
        term: "OOM kill",
        meaning:
          "El sistema mata la aplicación porque se quedó sin memoria. Se cae y vuelve a arrancar, perdiendo lo que estaba haciendo.",
      },
      {
        term: "Probe (chequeo de salud)",
        meaning:
          "Una revisión automática que pregunta '¿sigues viva?' y '¿ya puedes atender?'. Sin ella, el sistema manda tráfico a copias que no responden.",
      },
      {
        term: "Réplica",
        meaning:
          "Cada copia de la aplicación. Con una sola, cualquier falla la deja fuera de servicio; con varias, las otras siguen atendiendo.",
      },
      {
        term: "HPA (autoescalado)",
        meaning:
          "El mecanismo que agrega o quita copias solo, según la carga. Si llega a su máximo, ya no puede crecer más aunque haga falta.",
      },
      {
        term: "Tier",
        meaning:
          "Qué tan crítica es la aplicación para el negocio, según el catálogo de propiedad. Tier 1 es lo más crítico.",
      },
      {
        term: "Squad / Tribu",
        meaning:
          "El equipo dueño de la aplicación y el área a la que pertenece. Sirve para saber a quién le toca actuar.",
      },
      {
        term: "Grail / DQL",
        meaning:
          "Grail es la base de datos de Dynatrace donde se guarda todo lo observado, y DQL el lenguaje con el que se le pregunta. Cada número de esta app sale de una consulta DQL en vivo.",
      },
    ],
    filters: {
      cluster: "Cluster",
      clusterAll: "Cluster: todos",
      namespace: "Namespace",
      namespaceAll: "Namespace: todos",
      tier: "Tier",
      tierAll: "Tier: todos",
      tribu: "Tribu",
      tribuAll: "Tribu: todas",
      squad: "Squad",
      squadAll: "Squad: todos",
      extraAll: (label: string) => `${label}: todos`,
    },
  },
  chart: {
    groupBy: "Agrupar por",
    loading: "Cargando gráfica",
    loadingTrend: "Cargando tendencia de nodos",
    noData: "(sin dato)",
    noCluster: "(sin clúster)",
    noNode: "(sin nodo)",
    noTier: "(sin tier)",
    dqlError: "Error DQL:",
    dimension: {
      tier: "Tier",
      squad: "Squad",
      tribu: "Tribu",
      rango_mem: "Rango de memoria reservada",
      uso_vs_reserva: "Uso vs. reserva",
    },
    by: (noun: string, dimension: string) => `${noun} por ${dimension.toLowerCase()}`,
    nouns: {
      verdicts: "Veredictos",
      criticality: "Criticidad",
      elasticity: "Elasticidad",
      severity: "Severidad",
      orphans: "Huérfanos",
      signals: "Señales",
      problems: "Problemas",
      risk: "Riesgo",
    },
    axis: {
      workloads: "Workloads",
      pods: "Pods",
      hpas: "HPAs",
      containers: "Contenedores",
      nodes: "Nodos",
      node: "Nodo",
      cluster: "Clúster",
      hostUsage: "% uso host",
      repos: "Repos",
      tier: "Tier",
    },
    nodesByAction: "Nodos por acción y clúster",
    noSaturation: "Ningún nodo supera el 80% de CPU o memoria del host.",
    saturationTitle: "Saturación de nodos (host CPU/MEM > 80%)",
    nodeHealthTitle: "Salud de nodos por clúster",
    reposByTier: "Repositorios por tier",
    activeNodesPerDay: "Nodos activos por día (30 días)",
    spendGrowing: "¿el gasto está creciendo?",
  },
};
