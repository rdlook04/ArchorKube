import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { stateClient } from "@dynatrace-sdk/client-state";

import type { Lang } from "../i18n";
import type { DataMode } from "./redact";

/**
 * Preferencias por usuario (user app state): el modo de datos del envío a IA y
 * el idioma. Siguen al usuario entre navegadores y nadie más las ve. La clave
 * conserva su nombre original para no perder lo ya guardado. La URL del
 * puente NO va aquí, vive en localStorage porque depende de la máquina.
 */
export interface AiSettings {
  dataMode: DataMode;
  /** Idioma de la interfaz; inglés salvo que el usuario elija español. */
  language: Lang;
}

const STATE_KEY = "archorkube-ai-settings-v1";

/** Si no se puede leer la preferencia, se asume la opción que no expone nada. */
const DEFAULTS: AiSettings = { dataMode: "placeholders", language: "en" };

const parse = (raw: string | undefined): AiSettings => {
  try {
    const value = JSON.parse(raw ?? "{}") as Partial<AiSettings>;
    return {
      dataMode: value.dataMode === "real" ? "real" : "placeholders",
      language: value.language === "es" ? "es" : "en",
    };
  } catch {
    return DEFAULTS;
  }
};

interface AiSettingsContextValue {
  settings: AiSettings;
  loaded: boolean;
  save: (next: AiSettings) => Promise<void>;
}

const AiSettingsContext = createContext<AiSettingsContextValue>({
  settings: DEFAULTS,
  loaded: false,
  save: () => Promise.resolve(),
});

export const AiSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AiSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    stateClient
      .getUserAppState({ key: STATE_KEY })
      .then((state) => setSettings(parse(state.value)))
      // 404 la primera vez (nunca se guardó) o scope faltante: queda el default.
      .catch(() => setSettings(DEFAULTS))
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(async (next: AiSettings) => {
    await stateClient.setUserAppState({
      key: STATE_KEY,
      body: { value: JSON.stringify(next) },
    });
    setSettings(next);
  }, []);

  return (
    <AiSettingsContext.Provider value={{ settings, loaded, save }}>
      {children}
    </AiSettingsContext.Provider>
  );
};

export const useAiSettings = () => useContext(AiSettingsContext);
