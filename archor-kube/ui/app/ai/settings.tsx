import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { stateClient } from "@dynatrace-sdk/client-state";

import type { DataMode } from "./redact";

/**
 * Preferencias del envío a IA, por usuario (user app state): siguen al usuario
 * entre navegadores y nadie más las ve. La URL del puente NO va aquí, vive en
 * localStorage porque depende de la máquina.
 */
export interface AiSettings {
  dataMode: DataMode;
}

const STATE_KEY = "archorkube-ai-settings-v1";

/** Si no se puede leer la preferencia, se asume la opción que no expone nada. */
const DEFAULTS: AiSettings = { dataMode: "placeholders" };

const parse = (raw: string | undefined): AiSettings => {
  try {
    const value = JSON.parse(raw ?? "{}") as Partial<AiSettings>;
    return { dataMode: value.dataMode === "real" ? "real" : "placeholders" };
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
