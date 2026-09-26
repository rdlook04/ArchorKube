import { useAiSettings } from "../ai/settings";
import { en, es } from "./ui";
import type { UiText } from "./ui";

/**
 * Idiomas de la app. Inglés por defecto; español como opción en Settings
 * (decisión de Ruben, 2026-09-26). No se detecta el idioma del navegador ni el
 * de Dynatrace: cada usuario elige, y quien no elige ve inglés.
 *
 * Dos formas de traducir, según el tipo de texto:
 *  - la interfaz (botones, títulos, avisos) vive en `ui.ts`, un diccionario
 *    por idioma con el mismo tipo: si falta una clave en español, el build
 *    falla;
 *  - los datos largos que se mantienen juntos (el catálogo de prácticas, los
 *    chequeos de Setup) usan `Localized`, los dos idiomas lado a lado.
 *
 * Los códigos que salen del DQL (RIESGO_DISPONIBILIDAD, perdida_mes_usd…) no
 * se traducen: son el contrato de las consultas. Se traduce lo que se muestra.
 */
export type Lang = "en" | "es";

export const DEFAULT_LANG: Lang = "en";

/** Un texto en los dos idiomas, para datos que se leen mejor juntos. */
export interface Localized {
  en: string;
  es: string;
}

const DICTIONARIES: Record<Lang, UiText> = { en, es };

/** Idioma elegido por el usuario en Settings (inglés si no eligió). */
export const useLang = (): Lang => useAiSettings().settings.language;

/**
 * Textos de la interfaz en el idioma del usuario, más `L()` para resolver un
 * `Localized`.
 */
export const useT = () => {
  const lang = useLang();
  return { lang, t: DICTIONARIES[lang], L: (text: Localized) => text[lang] };
};

/** Lo mismo fuera de React (chequeos, prompts), con el idioma explícito. */
export const textFor = (lang: Lang): UiText => DICTIONARIES[lang];
