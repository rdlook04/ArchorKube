import React from "react";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import { Tooltip } from "@dynatrace/strato-components/overlays";
import { ClockIcon, DataTableIcon, SyncDoneIcon } from "@dynatrace/strato-icons";

import { useT } from "../i18n";
import type { Lang } from "../i18n";
import type { UiText } from "../i18n/ui";
import {
  type AnalysisWindow,
  formatClock,
  formatClockRange,
  windowLabel,
} from "../queries/analysisWindow";

/** Icono por tipo de ventana: rango móvil, foto del ahora, catálogo. */
const iconFor = (kind: AnalysisWindow["kind"]) => {
  if (kind === "range") return ClockIcon;
  if (kind === "snapshot") return SyncDoneIcon;
  return DataTableIcon;
};

/**
 * Segunda línea del badge: para un rango, las horas de reloj concretas que
 * cubre la consulta; para una foto, el momento en que se consultó.
 */
const clockText = (
  window: AnalysisWindow,
  queriedAt: Date,
  lang: Lang,
  t: UiText,
): string | undefined => {
  if (window.kind === "range" && window.hours) {
    return formatClockRange(window.hours, queriedAt, lang);
  }
  if (window.kind === "snapshot") return t.module.queriedAt(formatClock(queriedAt, lang));
  return undefined;
};

interface AnalysisWindowBadgeProps {
  window: AnalysisWindow;
  /** Momento de la última ejecución de las queries. */
  queriedAt: Date;
}

/**
 * Indica qué periodo de datos está viendo el usuario. Cada módulo consulta una
 * ventana distinta (2 h de métricas, 24 h de logs, 7 días de tráfico o la foto
 * del estado actual), y sin esto la única forma de saberlo era leer el DQL.
 */
export const AnalysisWindowBadge = ({ window, queriedAt }: AnalysisWindowBadgeProps) => {
  const { t, lang } = useT();
  const Icon = iconFor(window.kind);
  const clock = clockText(window, queriedAt, lang, t);

  return (
    <Tooltip text={window.detail[lang]} placement="bottom">
      <Flex
        alignItems="center"
        gap={8}
        paddingLeft={12}
        paddingRight={12}
        paddingTop={4}
        paddingBottom={4}
        style={{
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          borderRadius: Borders.Radius.Field.Default,
          background: Colors.Background.Container.Neutral.Default,
          cursor: "help",
        }}
      >
        <Icon size={16} style={{ color: Colors.Text.Primary.Default, flexShrink: 0 }} />
        <Text style={{ color: Colors.Text.Neutral.Default, fontWeight: 600 }}>
          {windowLabel(window, lang)}
        </Text>
        {clock && (
          <>
            <span aria-hidden style={{ color: Colors.Border.Neutral.Default }}>·</span>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>{clock}</Text>
          </>
        )}
      </Flex>
    </Tooltip>
  );
};
