/**
 * Envío de un prompt al puente local de Ollama (`tools/ollama-bridge`).
 *
 * La app no puede hacer fetch a localhost: la CSP de la plataforma solo deja
 * conectarse a Dynatrace, y `app.config.json` no permite ampliar connect-src.
 * Lo que sí puede es abrir una ventana. El puente corre en la máquina del
 * usuario, avisa que está listo y recién entonces recibe el prompt por
 * postMessage, dirigido solo a su origen.
 *
 * La URL del puente vive en localStorage: es una preferencia de este
 * navegador, no configuración del tenant.
 */

const BRIDGE_URL_KEY = "archorkube.bridge.url";
export const DEFAULT_BRIDGE_URL = "http://localhost:8765/";

/** Tiempo máximo para que el puente cargue y avise; después se asume caído. */
const READY_TIMEOUT_MS = 15000;

export const getBridgeUrl = (): string => {
  try {
    return window.localStorage.getItem(BRIDGE_URL_KEY) || DEFAULT_BRIDGE_URL;
  } catch {
    return DEFAULT_BRIDGE_URL;
  }
};

/** Vacío vuelve al default. Devuelve false si no es una URL http(s) válida. */
export const setBridgeUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (trimmed) {
    try {
      if (!/^https?:$/.test(new URL(trimmed).protocol)) return false;
    } catch {
      return false;
    }
  }
  try {
    if (trimmed) window.localStorage.setItem(BRIDGE_URL_KEY, trimmed);
    else window.localStorage.removeItem(BRIDGE_URL_KEY);
  } catch {
    // Sin storage se sigue usando el default.
  }
  return true;
};

export type BridgeResult = "sent" | "blocked" | "timeout";

/**
 * Abre el puente y le entrega el prompt. Hay que llamarla directo desde el
 * handler del clic: si hay un `await` antes, el navegador bloquea la ventana.
 */
export const sendToOllamaBridge = (prompt: string, module: string): Promise<BridgeResult> => {
  const url = getBridgeUrl();
  const bridgeOrigin = new URL(url).origin;
  // Nombre fijo: un segundo envío reutiliza la misma ventana en vez de abrir otra.
  const win = window.open(url, "archorkube-ollama-bridge");
  if (!win) return Promise.resolve("blocked");

  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      // Solo la ventana que abrimos, desde el origen configurado.
      if (event.source !== win || event.origin !== bridgeOrigin) return;
      const data = event.data as { type?: string; v?: number } | null;
      if (data?.type !== "archorkube:ready" || data.v !== 1) return;
      cleanup();
      win.postMessage({ type: "archorkube:prompt", v: 1, prompt, module }, bridgeOrigin);
      resolve("sent");
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve("timeout");
    }, READY_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);
  });
};
