import type { PracticeId, PracticeText, Severity } from "./catalog";

/**
 * Español del catálogo. La estructura (id, código, severidad, YAML, módulo que
 * la mide) vive en `catalog.ts`; aquí solo el texto. El tipo exige una entrada
 * por cada práctica: si se agrega una en `catalog.ts` sin traducirla, el build
 * falla.
 */
export const SEVERITY_ES: Record<Severity, { label: string; meaning: string }> = {
  critical: { label: "Crítica", meaning: "Causa caídas directamente. Se corrige primero." },
  high: {
    label: "Alta",
    meaning: "Provoca caídas o desalojos bajo carga, muchas veces en pods de otros equipos.",
  },
  medium: {
    label: "Media",
    meaning: "Degrada la latencia o la ubicación de los pods, pero rara vez tumba un servicio.",
  },
  cost: {
    label: "Costo",
    meaning: "No afecta la disponibilidad; es plata pagada por capacidad que nadie usa.",
  },
  security: {
    label: "Seguridad",
    meaning: "No afecta la disponibilidad; limita el daño si alguien compromete el servicio.",
  },
  traceability: {
    label: "Trazabilidad",
    meaning:
      "No afecta la disponibilidad; hace que los despliegues sean reproducibles y auditables.",
  },
};

export const PRACTICES_ES: Record<PracticeId, PracticeText> = {
  "readiness-probe": {
    title: "Readiness probe",
    what: "Un chequeo que Kubernetes le hace a cada copia de tu app (cada pod) para preguntarle: ¿estás listo para recibir tráfico ahora? Hasta que responde que sí, el pod no recibe requests.",
    why: "Sin ella, Kubernetes le manda tráfico a un pod apenas arranca su proceso, aunque todavía esté cargando la configuración, calentando caches o conectándose a su base de datos.",
    incident:
      "Cada despliegue y cada reinicio produce una ráfaga de errores 5xx y timeouts: los usuarios llegan a pods nuevos que todavía no están listos, o a pods viejos que ya se están apagando.",
    howTo: [
      "Expón un endpoint liviano (por ejemplo /ready) que responda 200 solo cuando la app de verdad puede atender requests.",
      "Configura readinessProbe en cada contenedor que recibe tráfico.",
      "Define initialDelaySeconds y periodSeconds según el tiempo real de arranque de la app, no según una plantilla.",
    ],
    caveat:
      "Está bien que la readiness revise dependencias críticas (un pod que no llega a su base de datos no debería recibir tráfico). Es justo lo que la liveness NO debe hacer.",
    owner: "El squad dueño del servicio",
    how: "Marca un workload cuando alguno de sus contenedores no tiene readinessProbe en el spec del pod.",
  },
  "liveness-probe": {
    title: "Liveness probe",
    what: "Un chequeo que Kubernetes hace para preguntar: ¿sigues vivo? Si la respuesta es no varias veces seguidas, Kubernetes reinicia el contenedor.",
    why: "Un proceso puede colgarse sin caerse (un deadlock, un pool de hilos agotado). Sin liveness, Kubernetes lo ve corriendo y nunca lo reinicia.",
    incident:
      "Una caída silenciosa: el pod aparece como Running, el monitoreo no ve ningún crash y cada request a ese pod termina en timeout hasta que alguien lo reinicia a mano.",
    howTo: [
      "Expón un endpoint (por ejemplo /health) que revise solo al propio proceso.",
      "Configura livenessProbe con un failureThreshold generoso, para que un momento lento no dispare un reinicio.",
      "Para apps que tardan en arrancar, agrega una startupProbe para que la liveness no mate al pod mientras inicia.",
    ],
    caveat:
      "Nunca hagas que la liveness dependa de una base de datos u otro servicio. Si esa dependencia cae, todos los pods fallan la liveness y se reinician a la vez, y un problema parcial se vuelve una caída total.",
    owner: "El squad dueño del servicio",
    how: "Marca un workload cuando alguno de sus contenedores no tiene livenessProbe en el spec del pod.",
  },
  "multiple-replicas": {
    title: "Más de una réplica",
    what: "Correr al menos dos copias (réplicas) de la app al mismo tiempo, para que una pueda irse mientras la otra sigue atendiendo.",
    why: "Con una sola réplica, cualquier cosa que detenga ese pod detiene el servicio: un crash, un despliegue o el equipo de plataforma parchando el nodo donde corre.",
    incident:
      "Un mantenimiento de rutina de nodos un martes en la noche deja el servicio caído unos minutos. Nadie tocó la app, y aun así cuenta como una caída.",
    howTo: [
      "Pon al menos 2 réplicas en todo lo que usan los usuarios u otros servicios.",
      "Agrega un PodDisruptionBudget para que las interrupciones voluntarias (drenar nodos, actualizaciones) nunca se lleven todas las réplicas a la vez.",
      "Reparte las réplicas entre nodos (topologySpreadConstraints) para que la falla de un nodo no se lleve a las dos.",
    ],
    caveat:
      "Dos réplicas solo sirven si las dos pueden recibir tráfico: necesitan readiness probe, y la app no debe guardar en memoria un estado que la otra copia no tiene. Los jobs batch y los singletons (un scheduler que debe correr una sola vez) son excepciones legítimas.",
    owner: "El squad dueño del servicio",
    how: "Marca Deployments y StatefulSets con replicas = 1 o sin replicas definidas. El módulo de Riesgo suma las probes faltantes al mismo puntaje.",
  },
  "memory-limit": {
    title: "Límite de memoria",
    what: "La memoria máxima que puede usar un contenedor. Si la supera, Kubernetes lo mata (un OOMKill, sin memoria).",
    why: "Sin límite, una fuga de memoria en una app crece hasta que la máquina entera (el nodo) se queda sin memoria y el kernel empieza a matar procesos, incluidas las apps de otros equipos.",
    incident:
      "El vecino ruidoso: un servicio pierde memoria de noche y, al amanecer, pods que no tienen nada que ver en el mismo nodo fueron matados o desalojados. Al que le suena la alerta no es al equipo que tiene el bug.",
    howTo: [
      "Mira el uso real de memoria del contenedor durante al menos una semana (lo muestra el módulo de Rightsizing).",
      "Define limits.memory con margen sobre el pico observado, típicamente entre 20 y 30%.",
      "Si el contenedor sigue muriendo por OOM, busca una fuga antes de solo subir el límite (el módulo Preventiva muestra los OOM kills).",
    ],
    caveat:
      "A diferencia de la CPU, la memoria no se puede estrangular: pasarse del límite significa morir. Poner el límite de memoria igual al request es una elección común y predecible.",
    owner: "El squad dueño del servicio",
    how: "Marca un workload cuando alguno de sus contenedores no tiene resources.limits.memory.",
  },
  "memory-request": {
    title: "Request de memoria",
    what: "La memoria que un contenedor reserva en el nodo. Kubernetes la usa para decidir dónde cabe el pod.",
    why: "Sin request, Kubernetes cree que el pod no necesita memoria y mete demasiados pods en un nodo. En el papel caben todos y en la práctica se quedan sin memoria.",
    incident:
      "En el pico de carga los nodos se quedan sin memoria y Kubernetes desaloja pods para recuperarse. Los pods sin request son los primeros en irse, muchas veces en la hora de más tráfico.",
    howTo: [
      "Define requests.memory cerca del uso típico del contenedor, no de su pico.",
      "Revísalo con el módulo de Rightsizing: un request muy por encima del uso desperdicia plata, uno por debajo arriesga desalojos.",
    ],
    owner: "El squad dueño del servicio",
    how: "Marca un workload cuando alguno de sus contenedores no tiene resources.requests.memory.",
  },
  "autoscaler-headroom": {
    title: "Autoescalado con margen para crecer",
    what: "Cuando una app escala sola (un HorizontalPodAutoscaler, HPA), su máximo de réplicas tiene que dejar espacio por encima de lo que usa normalmente.",
    why: "Un autoescalado en su máximo no puede agregar réplicas cuando crece el tráfico. Uno cuyo mínimo es igual a su máximo nunca escala: solo parece autoescalado.",
    incident:
      "Llega un pico de tráfico, el autoescalado quiere más pods pero está topado y los existentes se saturan: sube la latencia y empiezan a fallar requests mientras el dashboard dice que el autoescalado está activo.",
    howTo: [
      "Define maxReplicas con margen real sobre el pico habitual, y revisa que el cluster tenga capacidad para eso.",
      "Haz que minReplicas sea menor que maxReplicas; si la cantidad debe ser fija, quita el HPA y define las réplicas de forma honesta.",
      "Revisa los HPAs que están en su máximo: o lo subes o averiguas por qué la app necesita tantos pods.",
    ],
    caveat:
      "El HPA escala según el uso relativo al request, así que un request de CPU equivocado lo hace escalar demasiado pronto o demasiado tarde. Primero corrige el rightsizing, después ajusta el HPA.",
    owner: "El squad dueño del servicio, con el equipo de plataforma para la capacidad del cluster",
    how: "Marca los HPAs cuya condición ScalingLimited dice TooManyReplicas (topados en el máximo) y los HPAs donde minReplicas es igual a maxReplicas.",
  },
  "stable-containers": {
    title: "Sin OOM kills ni bucles de reinicio",
    what: "Los contenedores deberían mantenerse arriba. Un OOM kill significa que el contenedor superó su límite de memoria y fue matado; un bucle de reinicio significa que se cae y vuelve una y otra vez.",
    why: "Cada reinicio corta los requests en curso y, mientras el pod está abajo, las demás réplicas cargan con su tráfico. Los reinicios repetidos son además el primer aviso de una caída mayor.",
    incident:
      "Un servicio se reinicia varias veces al día y nadie lo nota, hasta que un pico de tráfico hace que todas sus réplicas se reinicien al mismo tiempo.",
    howTo: [
      "Para los OOM kills, compara el uso de memoria con el límite: si el uso sube de forma sostenida hasta el kill, es una fuga; si es solo un pico, sube el límite.",
      "Para los bucles de reinicio, lee los logs del contenedor anterior para ver por qué termina.",
      "Revisa la liveness probe: una probe demasiado estricta reinicia contenedores sanos.",
    ],
    caveat:
      "Subir el límite de memoria hace desaparecer el OOM kill hoy; si la causa es una fuga, vuelve después y más grande. Mira la tendencia de memoria antes de cambiar el número.",
    owner: "El squad dueño del servicio",
    how: "Marca workloads que en las últimas 24 horas tuvieron algún OOM kill, más de 10 reinicios (un bucle) o más de 3 reinicios (elevados).",
  },
  "cpu-limit": {
    title: "Límite de CPU",
    what: "La CPU máxima que puede usar un contenedor. Pasarse no lo mata: Kubernetes lo frena (throttling).",
    why: "Sin límite, un contenedor ocupado puede tomar toda la CPU de un nodo y frenar a todos los demás pods que corren ahí.",
    incident:
      "Picos de latencia en servicios que no hicieron nada malo: comparten nodo con un job batch o un bucle desbocado que se quedó con todos los núcleos.",
    howTo: [
      "Define limits.cpu bastante por encima del request, para que las ráfagas normales no se estrangulen.",
      "Después de definirlo, mira el throttling en el módulo Cuellos de botella: un throttling sostenido significa que el límite es bajo.",
    ],
    caveat:
      "Los límites de CPU se discuten en la comunidad de Kubernetes: un límite demasiado ajustado estrangula tu propia app aunque el nodo tenga CPU libre. Este estándar exige uno, así que ponlo holgado y deja que Cuellos de botella te avise si molesta.",
    owner: "El squad dueño del servicio",
    how: "Marca un workload cuando alguno de sus contenedores no tiene resources.limits.cpu.",
  },
  "cpu-request": {
    title: "Request de CPU",
    what: "La CPU que un contenedor reserva en el nodo (250m es un cuarto de núcleo). Kubernetes la usa para ubicar el pod y para repartir la CPU con justicia cuando falta.",
    why: "Sin request, el pod tiene la prioridad más baja cuando la CPU escasea, y Kubernetes puede ubicarlo en un nodo que ya está lleno.",
    incident:
      "El servicio anda bien con poco tráfico y se pone lento justo cuando sube la carga, porque es el primero en perder CPU frente a sus vecinos.",
    howTo: [
      "Define requests.cpu cerca del uso típico del contenedor.",
      "Ajústalo con el módulo de Rightsizing: una brecha grande entre request y uso es plata reservada que nunca se usa.",
    ],
    owner: "El squad dueño del servicio",
    how: "Marca un workload cuando alguno de sus contenedores no tiene resources.requests.cpu.",
  },
  "right-sized-requests": {
    title: "Requests cerca del uso real",
    what: "Lo que un contenedor reserva (sus requests) debería estar cerca de lo que realmente usa. Kubernetes ubica los pods según lo que reservan, no según lo que usan.",
    why: "Reservar mucho más de lo que se usa deja capacidad de nodo bloqueada y pagada, pero ociosa. Reservar menos de lo que se usa mete demasiados pods en un nodo, y se pelean por CPU y memoria.",
    incident:
      "El cluster sigue sumando nodos porque parece lleno, mientras el uso real es una fracción. La factura crece cada mes y nada está más ocupado.",
    howTo: [
      "Mira el uso real en el módulo de Rightsizing antes de cambiar nada.",
      "Define los requests cerca del uso típico y deja los picos a los límites.",
      "Si el throttling de CPU es alto, sube el límite de CPU (o el request) antes de tocar cualquier otra cosa.",
      "Cambia pocos workloads a la vez y mira la latencia.",
    ],
    caveat:
      "El módulo de Rightsizing mira una ventana corta. Los cierres de mes, las campañas o las ventanas batch pueden necesitar mucho más de lo que muestra un día normal, así que revisa el historial antes de recortar.",
    owner: "El squad dueño del servicio, con FinOps para priorizar",
    how: "Lista pods con más del 40% del request de CPU o memoria sin usar, con uso por encima del request (subdimensionados) o con throttling de CPU sobre 25%. Desde 70% sin usar los marca como sobreaprovisionados; entre 40% y 70%, como a revisar.",
  },
  "no-idle-workloads": {
    title: "Apagar lo que nadie usa",
    what: "Un workload sin tráfico ni actividad durante una semana debería escalarse a cero o eliminarse, no quedar corriendo.",
    why: "Un workload ocioso sigue reservando CPU y memoria en los nodos, y esa reserva se paga cada hora, lo llame alguien o no.",
    incident:
      "Una versión vieja de un servicio, un experimento terminado o un ambiente de pruebas olvidado sigue corriendo durante meses. Cada uno es chico; juntos son nodos enteros que la empresa paga.",
    howTo: [
      "Confirma que de verdad está ocioso: sin tráfico de negocio en una semana, y sin caerse (un servicio roto también se ve tranquilo).",
      "Pregúntale al squad dueño: algunos servicios solo trabajan a fin de mes o en un proceso anual.",
      "Primero escálalo a cero y bórralo después, para que pueda volver rápido si alguien lo necesitaba.",
      "Para servicios con tráfico irregular, usa autoescalado a cero (por ejemplo KEDA) en vez de mantener réplicas arriba.",
    ],
    caveat:
      "CPU baja por sí sola no es ocioso: un servicio eficiente puede atender miles de requests casi sin CPU. ArchorKube solo confirma un ocioso cuando coinciden tráfico, estabilidad y CPU.",
    owner: "El squad dueño del servicio, con FinOps",
    how: "Confirma un ocioso solo cuando se cumplen las tres condiciones durante 7 días: 10 requests de APM o menos, sin OOM kills ni bucles de reinicio, y CPU casi en cero (promedio bajo 5 mc y pico bajo 20 mc).",
  },
  "non-root": {
    title: "Correr sin root",
    what: "El proceso del contenedor corre como un usuario común, no como root (el administrador).",
    why: "Si un atacante entra a un contenedor que corre como root, le es mucho más fácil escaparse al nodo y llegar a todo lo demás que corre ahí.",
    incident:
      "Una vulnerabilidad en un servicio expuesto a internet termina comprometiendo el nodo entero, y todos los pods de otros equipos que corren en él.",
    howTo: [
      "Construye la imagen con un usuario que no sea root (una línea USER en el Dockerfile).",
      "Define runAsNonRoot: true para que Kubernetes se niegue a iniciar el contenedor si fuera a correr como root.",
      "De paso, agrega allowPrivilegeEscalation: false.",
    ],
    owner: "El squad dueño del servicio, con el equipo de plataforma o de seguridad",
    how: "Marca un workload cuando un contenedor corre como usuario 0 o no tiene runAsUser, y runAsNonRoot no es true.",
  },
  "helm-managed": {
    title: "Desplegado con Helm",
    what: "El workload se instaló con Helm, una herramienta que despliega apps de Kubernetes desde plantillas versionadas.",
    why: "Un workload creado a mano (o que quedó de una instalación vieja) no tiene una fuente que alguien pueda revisar: no se sabe qué cambió, no se puede volver a desplegar igual ni revertir limpio.",
    incident:
      "Después de un incidente nadie puede decir qué versión está corriendo ni quién cambió sus límites. La corrección se vuelve a aplicar a mano, y el siguiente despliegue la deshace.",
    howTo: [
      "Lleva los manifiestos del workload a un chart de Helm en un repositorio.",
      "Despliégalo por el pipeline, nunca con kubectl apply desde una laptop.",
      "Helm agrega por sí solo la label app.kubernetes.io/managed-by: Helm; eso es lo que revisa la app.",
    ],
    caveat:
      "Los workloads desplegados con otras herramientas declarativas (Argo CD, Flux, Kustomize) aparecen aquí como incumplidos. Si ese es tu estándar, lee esta spec como '¿se despliega desde un repositorio?'.",
    owner: "El squad dueño del servicio, con el equipo de plataforma",
    how: "Marca un workload cuando su Deployment/StatefulSet/DaemonSet/Job no tiene la label app.kubernetes.io/managed-by = Helm.",
  },
  "owned-workloads": {
    title: "Cada workload tiene dueño y una razón para existir",
    what: "Cada workload del cluster debería estar registrado a nombre de un squad en el catálogo de propiedad, y lo que quedó escalado a cero para siempre debería eliminarse.",
    why: "Un workload sin dueño no tiene a quién llamar cuando se rompe ni quién decida si todavía hace falta. Un workload en cero réplicas es ruido que esconde lo que de verdad corre.",
    incident:
      "Salta una alerta en un servicio que nadie reconoce. La persona de guardia pasa una hora averiguando de quién es y, al final, no es de nadie.",
    howTo: [
      "Registra el workload en el catálogo de propiedad con su squad y su app code, usando el mismo nombre que tiene en el cluster.",
      "Agrega labels de propiedad al manifiesto como respaldo.",
      "Para los workloads en cero réplicas, confirma con el dueño y borra el manifiesto si ya no se necesita.",
    ],
    caveat:
      "Un workload puede parecer sin dueño solo porque su nombre en el catálogo es distinto del nombre en el cluster. Revisa el nombre antes de darlo por abandonado.",
    owner: "El equipo de plataforma, con cada squad manteniendo al día sus entradas del catálogo",
    how: "Marca Deployments y StatefulSets escalados a 0 réplicas, y workloads corriendo cuyo nombre no coincide con ningún squad ni app code del catálogo de propiedad.",
  },
};
