import React, { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { showToast } from "@dynatrace/strato-components/notifications";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { WarningIcon } from "@dynatrace/strato-icons";

import { sendToOllamaBridge } from "./ollamaBridge";
import type { BridgeResult } from "./ollamaBridge";
import { redactForExternal } from "./redact";
import { useAiSettings } from "./settings";

type Row = Record<string, unknown>;

const notifyResult = (result: BridgeResult) => {
  if (result === "sent") return;
  showToast({
    title: result === "blocked" ? "The browser blocked the window" : "The bridge did not answer",
    message:
      result === "blocked"
        ? "Allow pop-ups for this page and try again."
        : "Start it with: python -m http.server 8765 (in tools/ollama-bridge).",
    type: "warning",
    lifespan: 6000,
  });
};

interface Pending {
  text: string;
  module: string;
}

const ExternalSendContext = createContext<(p: Pending) => void>(() => undefined);

const dispatch = ({ text, module }: Pending) =>
  void sendToOllamaBridge(text, module).then(notifyResult);

/**
 * Un solo diálogo de advertencia para toda la app, montado una vez en App.
 * Las páginas no lo renderizan: piden el envío con `useExternalSend`.
 */
export const ExternalSendProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<Pending | null>(null);

  return (
    <ExternalSendContext.Provider value={setPending}>
      {children}
      <Modal
        show={pending !== null}
        onDismiss={() => setPending(null)}
        size="small"
        title={
          <Flex alignItems="center" gap={8}>
            <span style={{ color: Colors.Icon.Warning.Default, display: "flex" }}>
              <WarningIcon />
            </span>
            <span>Real Kubernetes names</span>
          </Flex>
        }
        footer={
          <Flex justifyContent="flex-end" gap={8} width="100%">
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button
              variant="emphasized"
              color="warning"
              onClick={() => {
                // Este clic es el gesto del usuario: la ventana del puente no se bloquea.
                if (pending) dispatch(pending);
                setPending(null);
              }}
            >
              Send anyway
            </Button>
          </Flex>
        }
      >
        <Flex flexDirection="column" gap={12}>
          <Paragraph>
            You are about to send the{" "}
            <Strong>real namespace, workload, pod and container names</Strong> to your local
            Ollama.
          </Paragraph>
          <Paragraph style={{ color: Colors.Text.Neutral.Subdued }}>
            The cluster name, owners, costs and tenant links are still removed. To send
            placeholders instead, change it in Settings.
          </Paragraph>
        </Flex>
      </Modal>
    </ExternalSendContext.Provider>
  );
};

/**
 * Envío de un hallazgo a la IA local, siempre filtrado por `redactForExternal`.
 *
 * - Modo placeholders: sale en el mismo clic.
 * - Modo datos reales: primero la advertencia del provider.
 */
export const useExternalSend = (build: (row: Row) => string, module: string) => {
  const { settings } = useAiSettings();
  const confirm = useContext(ExternalSendContext);

  return useCallback(
    (row: Row) => {
      const { text } = redactForExternal(build, row, settings.dataMode);
      if (settings.dataMode === "real") confirm({ text, module });
      else dispatch({ text, module });
    },
    [build, confirm, module, settings.dataMode],
  );
};
