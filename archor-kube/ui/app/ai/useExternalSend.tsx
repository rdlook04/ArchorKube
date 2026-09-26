import React, { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { MessageContainer } from "@dynatrace/strato-components/content";
import { TextArea } from "@dynatrace/strato-components/forms";
import { Flex } from "@dynatrace/strato-components/layouts";
import { showToast } from "@dynatrace/strato-components/notifications";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";

import { recordSend } from "./audit";
import type { Destination } from "./audit";
import { sendToOllamaBridge } from "./ollamaBridge";
import type { BridgeResult } from "./ollamaBridge";
import { redactForExternal } from "./redact";
import type { DataMode } from "./redact";
import { useAiSettings } from "./settings";

type Row = Record<string, unknown>;

const DESTINATION_COPY: Record<Destination, { title: string; action: string; target: string }> = {
  ollama: { title: "Send to local Ollama", action: "Send", target: "your local Ollama" },
  clipboard: {
    title: "Copy for another AI",
    action: "Copy to clipboard",
    target: "the clipboard, to paste in Claude, Gemini, ChatGPT or any other AI",
  },
};

const notifyBridge = (result: BridgeResult) => {
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

interface Preview {
  destination: Destination;
  module: string;
  mode: DataMode;
  original: string;
  text: string;
  replaced: string[];
}

type OpenPreview = (preview: Omit<Preview, "text">) => void;

const ExternalSendContext = createContext<OpenPreview>(() => undefined);

/**
 * Vista previa de todo lo que sale de Dynatrace hacia una IA externa, montada
 * una sola vez en App. Muestra el texto ya filtrado, deja editarlo y, en modo
 * de nombres reales, lo advierte. El envío sale del clic en el botón de la
 * vista previa: es un gesto del usuario, así que el navegador no bloquea la
 * ventana del puente ni el portapapeles.
 */
export const ExternalSendProvider = ({ children }: { children: ReactNode }) => {
  const [preview, setPreview] = useState<Preview | null>(null);

  const open = useCallback<OpenPreview>((p) => setPreview({ ...p, text: p.original }), []);
  const close = () => setPreview(null);

  const confirm = () => {
    if (!preview) return;
    const { destination, module, mode, original, text, replaced } = preview;
    if (destination === "ollama") {
      void sendToOllamaBridge(text, module).then(notifyBridge);
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() =>
          showToast({
            title: "Copied",
            message: "Paste it in any AI. Only what you saw in the preview was copied.",
            type: "success",
            lifespan: 4000,
          }),
        )
        .catch(() => showToast({ title: "Could not copy", type: "critical", lifespan: 4000 }));
    }
    recordSend({
      destination,
      module,
      mode,
      replaced,
      edited: text !== original,
      chars: text.length,
    });
    close();
  };

  const copy = preview ? DESTINATION_COPY[preview.destination] : null;

  return (
    <ExternalSendContext.Provider value={open}>
      {children}
      <Modal
        show={preview !== null}
        onDismiss={close}
        size="large"
        title={copy?.title ?? ""}
        footer={
          <Flex justifyContent="flex-end" gap={8} width="100%">
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="emphasized"
              color={preview?.mode === "real" ? "warning" : "primary"}
              onClick={confirm}
              disabled={!preview?.text.trim()}
            >
              {copy?.action}
            </Button>
          </Flex>
        }
      >
        {preview && copy && (
          <Flex flexDirection="column" gap={12}>
            {preview.mode === "real" && (
              <MessageContainer variant="warning">
                <MessageContainer.Title>Real Kubernetes names</MessageContainer.Title>
                <MessageContainer.Description>
                  This text has the real namespace, workload, pod and container names. To send
                  placeholders instead, change it in Settings.
                </MessageContainer.Description>
              </MessageContainer>
            )}
            <Paragraph>
              This is <Strong>exactly</Strong> what goes to {copy.target}. You can edit it before it
              leaves.
            </Paragraph>
            {preview.replaced.length > 0 && (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Removed or replaced: {preview.replaced.join(", ")}. Never sent: cluster name,
                owners, costs, tenant links, IPs and emails.
              </Text>
            )}
            <TextArea
              value={preview.text}
              onChange={(text) => setPreview({ ...preview, text })}
              rows={16}
              resize="vertical"
            />
          </Flex>
        )}
      </Modal>
    </ExternalSendContext.Provider>
  );
};

/**
 * Prepara el envío de un hallazgo a una IA fuera de Dynatrace: lo filtra con
 * `redactForExternal` según la preferencia del usuario y abre la vista previa.
 * Nada sale sin pasar por aquí.
 */
export const useExternalSend = (build: (row: Row) => string, module: string) => {
  const { settings } = useAiSettings();
  const openPreview = useContext(ExternalSendContext);

  return useCallback(
    (row: Row, destination: Destination) => {
      const { text, mode, replaced } = redactForExternal(build, row, settings.dataMode);
      openPreview({ destination, module, mode, original: text, replaced });
    },
    [build, module, openPreview, settings.dataMode],
  );
};
