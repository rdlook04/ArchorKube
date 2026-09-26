import React, { useState } from "react";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Checkbox } from "@dynatrace/strato-components/forms";
import { ExternalLink, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { WarningIcon } from "@dynatrace/strato-icons";

const REPO_URL = "https://github.com/rdlook04/ArchorKube";

/**
 * Versionada a propósito: si el texto del aviso cambia de fondo (por ejemplo
 * cuando exista la vista previa del envío a IA), se sube a v2 y todos lo
 * vuelven a ver una vez.
 */
const DISMISS_KEY = "archorkube.community-notice.dismissed.v1";

/** localStorage puede no existir o lanzar (modo privado, datos bloqueados). */
export const isNoticeDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

const saveDismissed = (dismissed: boolean) => {
  try {
    if (dismissed) window.localStorage.setItem(DISMISS_KEY, "1");
    else window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    // Sin storage el aviso vuelve a salir en la próxima carga; no es un error.
  }
};

interface CommunityNoticeProps {
  show: boolean;
  onClose: () => void;
}

/**
 * Aviso de app comunitaria: sale en la primera carga y desde el botón Help.
 * La estructura sigue la convención de otras apps no oficiales del ecosistema
 * (qué no es, dónde reportar, fork libre); los colores son los tokens de
 * advertencia de Strato, no una paleta propia.
 *
 * La línea de datos describe lo que la app hace HOY (solo lee Grail; lo que
 * sale, sale porque el usuario lo copia). Cuando exista la vista previa del
 * envío a IA, la promesa cambia y DISMISS_KEY sube de versión.
 */
export const CommunityNotice = ({ show, onClose }: CommunityNoticeProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(isNoticeDismissed);

  const close = () => {
    saveDismissed(dontShowAgain);
    onClose();
  };

  return (
    <Modal
      show={show}
      onDismiss={close}
      size="small"
      title={
        <Flex alignItems="center" gap={12}>
          <span style={{ color: Colors.Icon.Warning.Default, display: "flex" }}>
            <WarningIcon size="large" />
          </span>
          <Flex flexDirection="column" gap={2}>
            <Text
              textStyle="small-emphasized"
              style={{ color: Colors.Text.Warning.Default, letterSpacing: "0.08em" }}
            >
              IMPORTANT NOTICE
            </Text>
            <span>Unofficial community app</span>
          </Flex>
        </Flex>
      }
      footer={
        <Flex flexDirection="column" gap={16} width="100%">
          <Checkbox name="dont-show-again" value={dontShowAgain} onChange={setDontShowAgain}>
            Don&apos;t show this again
          </Checkbox>
          <Button variant="emphasized" color="warning" width="full" onClick={close}>
            Continue
          </Button>
        </Flex>
      }
    >
      <Flex flexDirection="column" gap={16}>
        <Paragraph>
          ArchorKube is <Strong>not an official Dynatrace app</Strong>, and you can&apos;t open a
          Dynatrace support ticket for it.
        </Paragraph>
        <Flex flexDirection="column" gap={8}>
          <Paragraph>You can report issues on the GitHub repository:</Paragraph>
          <div
            style={{
              alignSelf: "flex-start",
              padding: "6px 12px",
              background: Colors.Background.Container.Warning.Default,
              border: `1px solid ${Colors.Border.Warning.Accent}`,
              borderRadius: Borders.Radius.Container.Default,
            }}
          >
            <ExternalLink href={REPO_URL}>github.com/rdlook04/ArchorKube</ExternalLink>
          </div>
        </Flex>
        <Paragraph>Feel free to fork it for your own use.</Paragraph>
        <Paragraph style={{ color: Colors.Text.Neutral.Subdued }}>
          ArchorKube only reads data from your tenant. Nothing leaves Dynatrace unless you copy it
          or send it to an AI yourself.
        </Paragraph>
      </Flex>
    </Modal>
  );
};
