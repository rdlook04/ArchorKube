import React from "react";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Accordion, Markdown } from "@dynatrace/strato-components/content";
import { DQLEditor } from "@dynatrace/strato-components/editors";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";

import { useT } from "../i18n";
import { windowLabel } from "../queries/analysisWindow";
import type { AnalysisWindow } from "../queries/analysisWindow";

/**
 * Explicación del módulo sin jerga técnica.
 *
 * El panel lo lee gente que no administra Kubernetes: jefes de squad, gente de
 * negocio. Las tres preguntas son deliberadamente las mismas en todos los
 * módulos para que se aprendan a leer una sola vez.
 */
export interface SimpleExplanation {
  /** ¿Qué estoy viendo? Sin nombres de métricas ni de objetos de K8s. */
  que: string;
  /** ¿Por qué me importa? En plata, en riesgo de caída o en incumplimiento. */
  porque: string;
  /** ¿Qué hago con esto? La acción concreta, y de quién es. */
  accion: string;
}

/** Una de las tres preguntas del bloque en lenguaje llano. */
const SimpleAnswer = ({ question, answer }: { question: string; answer: string }) => (
  <Flex flexDirection="column" gap={2}>
    <Text style={{ color: Colors.Text.Primary.Default, fontWeight: 700 }}>{question}</Text>
    <Text style={{ color: Colors.Text.Neutral.Default }}>{answer}</Text>
  </Flex>
);

interface ModuleAboutProps {
  /** Explicación sin jerga; encabeza el panel cuando el módulo la define. */
  simple?: SimpleExplanation;
  /** Documento técnico del módulo (Markdown). */
  about: string;
  /** Periodo de datos que analiza el módulo. */
  window?: AnalysisWindow;
  /** Consultas realmente ejecutadas, con los filtros activos ya aplicados. */
  queries: { title: string; dql: string }[];
}

/**
 * Contenido del panel "Acerca de este módulo": primero la explicación llana,
 * después el detalle técnico, y al final —plegados— el glosario y el DQL exacto
 * que se ejecutó, para quien quiera auditar de dónde sale cada número.
 */
export const ModuleAbout = ({ simple, about, window, queries }: ModuleAboutProps) => {
  const { t, lang } = useT();
  return (
  <Flex flexDirection="column" gap={16}>
    {simple && (
      <Flex
        flexDirection="column"
        gap={12}
        padding={16}
        style={{
          background: Colors.Background.Container.Primary.Default,
          border: `1px solid ${Colors.Border.Primary.Default}`,
          borderRadius: Borders.Radius.Container.Default,
        }}
      >
        <Heading level={5} style={{ color: Colors.Text.Primary.Default }}>
          {t.module.simpleTitle}
        </Heading>
        <SimpleAnswer question={t.module.simpleWhat} answer={simple.que} />
        <SimpleAnswer question={t.module.simpleWhy} answer={simple.porque} />
        <SimpleAnswer question={t.module.simpleAction} answer={simple.accion} />
      </Flex>
    )}

    <Markdown>{about}</Markdown>

    {window && (
      <Flex flexDirection="column" gap={4}>
        <Heading level={5}>{t.module.windowTitle}</Heading>
        <Paragraph>
          <Text style={{ fontWeight: 700 }}>{windowLabel(window, lang)}.</Text>{" "}
          {window.detail[lang]}
        </Paragraph>
      </Flex>
    )}

    <Accordion multiple>
      <Accordion.Section id="glosario">
        <Accordion.SectionLabel>{t.module.glossaryTitle}</Accordion.SectionLabel>
        <Accordion.SectionContent>
          <Flex flexDirection="column" gap={12} paddingTop={8}>
            {t.module.glossary.map((entry) => (
              <Flex key={entry.term} flexDirection="column" gap={2}>
                <Text style={{ fontWeight: 700, color: Colors.Text.Neutral.Default }}>
                  {entry.term}
                </Text>
                <Text style={{ color: Colors.Text.Neutral.Subdued }}>{entry.meaning}</Text>
              </Flex>
            ))}
          </Flex>
        </Accordion.SectionContent>
      </Accordion.Section>

      <Accordion.Section id="dql">
        <Accordion.SectionLabel>{t.module.dqlTitle}</Accordion.SectionLabel>
        <Accordion.SectionContent>
          <Flex flexDirection="column" gap={12} paddingTop={8}>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>{t.module.dqlHint}</Text>
            {queries.map((query) => (
              <Flex key={query.title} flexDirection="column" gap={4}>
                <Text style={{ fontWeight: 700, color: Colors.Text.Neutral.Default }}>
                  {query.title}
                </Text>
                <DQLEditor value={query.dql} readOnly />
              </Flex>
            ))}
          </Flex>
        </Accordion.SectionContent>
      </Accordion.Section>
    </Accordion>
  </Flex>
  );
};
