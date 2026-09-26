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
import { useT } from "../i18n";
import type { UiText } from "../i18n/ui";

type Row = Record<string, unknown>;

type SendText = UiText["send"];

const destinationCopy = (t: SendText, destination: Destination) =>
  destination === "ollama"
    ? { title: t.ollamaTitle, action: t.ollamaAction, target: t.ollamaTarget }
    : { title: t.clipboardTitle, action: t.clipboardAction, target: t.clipboardTarget };

const notifyBridge = (t: SendText) => (result: BridgeResult) => {
  if (result === "sent") return;
  showToast({
    title: result === "blocked" ? t.blocked : t.noAnswer,
    message: result === "blocked" ? t.blockedBody : t.noAnswerBody,
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
  const { t: ui } = useT();
  const t = ui.send;

  const open = useCallback<OpenPreview>((p) => setPreview({ ...p, text: p.original }), []);
  const close = () => setPreview(null);

  const confirm = () => {
    if (!preview) return;
    const { destination, module, mode, original, text, replaced } = preview;
    if (destination === "ollama") {
      void sendToOllamaBridge(text, module).then(notifyBridge(t));
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() =>
          showToast({
            title: t.copied,
            message: t.copiedBody,
            type: "success",
            lifespan: 4000,
          }),
        )
        .catch(() => showToast({ title: t.copyFailed, type: "critical", lifespan: 4000 }));
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

  const copy = preview ? destinationCopy(t, preview.destination) : null;

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
            <Button onClick={close}>{t.cancel}</Button>
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
                <MessageContainer.Title>{t.realTitle}</MessageContainer.Title>
                <MessageContainer.Description>{t.realBody}</MessageContainer.Description>
              </MessageContainer>
            )}
            <Paragraph>
              {t.exactlyLead} <Strong>{t.exactlyStrong}</Strong>
              {t.exactlyRest(copy.target)}
            </Paragraph>
            {preview.replaced.length > 0 && (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {t.removed(preview.replaced.join(", "))}
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
