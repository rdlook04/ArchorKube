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
};
