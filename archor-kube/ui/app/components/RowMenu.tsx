import React, { useCallback } from "react";
import type { IntentPayload } from "@dynatrace-sdk/navigation";

import { Button } from "@dynatrace/strato-components/buttons";
import { Menu } from "@dynatrace/strato-components/navigation";
import { DotMenuIcon } from "@dynatrace/strato-icons";

import { OLLAMA_BRIDGE_ENABLED } from "../ai/ollamaBridge";
import { useExternalSend } from "../ai/useExternalSend";
import { useT } from "../i18n";
import { labelCodesInText, labelRow } from "../i18n/codes";
import type { Lang, Localized } from "../i18n";
import { useOpenGuide } from "../practices/flagged";
import { standardSection } from "../practices/prompt";
import { ASSIST_INTENT_OPTIONS } from "../queries/assist";

type Row = Record<string, unknown>;

/** Etiquetas de los deep links que se repiten en casi todos los módulos. */
export const WORKLOAD_LINK: Localized = {
  en: "Open workload (Kubernetes)",
  es: "Abrir workload (Kubernetes)",
};
export const SERVICE_LINK: Localized = { en: "Open service (APM)", es: "Abrir servicio (APM)" };

export interface RowMenuLink {
  label: Localized;
  /** null deshabilita el link (el dato no vino en la fila). */
  href: string | null;
}

interface RowMenuProps {
  row: Row;
  /** Nombre corto del módulo: va al puente y al registro de envíos. */
  module: string;
  /** Arma el prompt con la evidencia de la fila, en el idioma pedido (queries/assist.ts). */
  prompt: (row: Row, lang: Lang) => string;
  /** Payload del intent de Assist; recibe la fila completa porque no sale del tenant. */
  assistPayload: (row: Row, lang: Lang) => IntentPayload;
  /** Prácticas del catálogo que la fila incumple; sin esto no hay "Why is this flagged?". */
  practices?: (row: Row) => string[];
  links?: RowMenuLink[];
}

/**
 * Menú de acciones de cada fila, igual en todos los módulos:
 *
 *  1. Why is this flagged? → la Guía con las prácticas que incumple.
 *  2. Ask Dynatrace Assist → intent con la fila completa (queda en el tenant).
 *  3. Send to local Ollama / Copy for another AI → siempre filtrado y con
 *     vista previa (ver ai/useExternalSend.tsx).
 *  4. Deep links a Dynatrace.
 *
 * Reemplaza los 11 menús casi idénticos que tenía cada página. El "Copiar
 * prompt para Assist" se fue: el intent ya abre Assist en modo agéntico, y
 * copiar la fila completa al portapapeles era una salida sin filtro.
 */
export const RowMenu = ({ row, module, prompt, assistPayload, practices, links }: RowMenuProps) => {
  const { t, L, lang } = useT();
  const openGuide = useOpenGuide();
  const flagged = practices ? practices(row) : null;
  // Las prácticas se calculan sobre la fila original: la filtrada puede no traer
  // los campos del veredicto. El texto del estándar no lleva datos de la fila.
  const standard = standardSection(flagged ?? [], lang);
  // El prompt sale en el idioma del usuario y le pide a la IA responder en ese
  // idioma, con los códigos de las consultas pasados a texto como en la tabla.
  const localizedPrompt = useCallback(
    (r: Row) => labelCodesInText(prompt(labelRow(r, lang), lang), lang) + standard,
    [prompt, lang, standard],
  );
  const sendExternal = useExternalSend(localizedPrompt, module);
  const assist = assistPayload(labelRow(row, lang), lang);
  const assistWithStandard =
    typeof assist.prompt === "string"
      ? { ...assist, prompt: labelCodesInText(assist.prompt, lang) + standard }
      : assist;

  return (
    <Menu>
      <Menu.Trigger>
        <Button aria-label={t.rowMenu.ariaLabel}>
          <DotMenuIcon />
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        {flagged && (
          <Menu.Item disabled={flagged.length === 0} onSelect={() => openGuide(flagged, row)}>
            {t.rowMenu.whyFlagged}
          </Menu.Item>
        )}
        <Menu.Intent payload={assistWithStandard} options={ASSIST_INTENT_OPTIONS}>
          {t.rowMenu.askAssist}
        </Menu.Intent>
        {OLLAMA_BRIDGE_ENABLED && (
          <Menu.Item onSelect={() => sendExternal(row, "ollama")}>{t.rowMenu.sendOllama}</Menu.Item>
        )}
        <Menu.Item onSelect={() => sendExternal(row, "clipboard")}>
          {t.rowMenu.copyForAi}
        </Menu.Item>
        {links?.map((link) => (
          <Menu.Link
            key={link.label.en}
            href={link.href ?? undefined}
            target="_blank"
            disabled={!link.href}
          >
            {L(link.label)}
          </Menu.Link>
        ))}
      </Menu.Content>
    </Menu>
  );
};
