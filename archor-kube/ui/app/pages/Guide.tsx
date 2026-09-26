import React, { useEffect, useRef } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Accordion, CodeSnippet, MessageContainer } from "@dynatrace/strato-components/content";
import { Flex } from "@dynatrace/strato-components/layouts";
import {
  Heading,
  Link,
  List,
  Paragraph,
  Strong,
  Text,
} from "@dynatrace/strato-components/typography";

import { PRACTICES, SEVERITY_META } from "../practices/catalog";
import type { Practice, Severity } from "../practices/catalog";

/** Colores por severidad, con los tokens de Strato (mismo criterio que los módulos). */
const SEVERITY_COLORS: Record<Severity, { text: string; border: string }> = {
  critical: { text: Colors.Text.Critical.Default, border: Colors.Border.Critical.Accent },
  high: { text: Colors.Text.Warning.Default, border: Colors.Border.Warning.Accent },
  medium: { text: Colors.Text.Primary.Default, border: Colors.Border.Primary.Accent },
  cost: { text: Colors.Text.Success.Default, border: Colors.Border.Success.Accent },
  security: { text: Colors.Text.Neutral.Default, border: Colors.Border.Neutral.Accent },
  traceability: { text: Colors.Text.Neutral.Default, border: Colors.Border.Neutral.Accent },
};

const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <span
    style={{
      color: SEVERITY_COLORS[severity].text,
      border: `1px solid ${SEVERITY_COLORS[severity].border}`,
      borderRadius: 999,
      padding: "1px 8px",
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {SEVERITY_META[severity].label}
  </span>
);

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Flex flexDirection="column" gap={4}>
    <Text textStyle="base-emphasized">{title}</Text>
    {children}
  </Flex>
);

const PracticeBody = ({ practice }: { practice: Practice }) => (
  <Flex flexDirection="column" gap={16} paddingTop={8} paddingBottom={16}>
    <Block title="What it is">
      <Paragraph>{practice.what}</Paragraph>
    </Block>
    <Block title="Why it matters">
      <Paragraph>{practice.why}</Paragraph>
    </Block>
    <Block title="What happens without it">
      <Paragraph>{practice.incident}</Paragraph>
    </Block>
    <Block title="How to comply">
      <List ordered>
        {practice.howTo.map((step) => (
          <Text key={step}>{step}</Text>
        ))}
      </List>
      <CodeSnippet language="yaml" showCopyAction>
        {practice.yaml}
      </CodeSnippet>
    </Block>
    {practice.caveat && (
      <MessageContainer variant="primary">
        <MessageContainer.Title>Worth knowing</MessageContainer.Title>
        <MessageContainer.Description>{practice.caveat}</MessageContainer.Description>
      </MessageContainer>
    )}
    <Flex gap={32} flexWrap="wrap">
      <Block title="How ArchorKube measures it">
        <Paragraph>
          {practice.measuredBy.how}{" "}
          <Link as={RouterLink} to={practice.measuredBy.route}>
            See it in {practice.measuredBy.module}
          </Link>
        </Paragraph>
      </Block>
      <Block title="Who usually fixes it">
        <Paragraph>{practice.owner}</Paragraph>
      </Block>
    </Flex>
  </Flex>
);

/**
 * M14 — Guía de buenas prácticas.
 *
 * Los módulos dicen qué incumple cada workload; la Guía explica por qué existe
 * cada regla y cómo se cumple, a nivel básico. Sin esto la gobernanza es un
 * semáforo que nadie entiende y termina ignorado.
 *
 * `?focus=a,b&workload=x` abre directamente las prácticas que incumple un
 * workload: es a donde lleva "Why is this flagged?" desde cada fila.
 */
export const Guide = () => {
  const [params] = useSearchParams();
  const focus = (params.get("focus") ?? "")
    .split(",")
    .filter((id) => PRACTICES.some((p) => p.id === id));
  const workload = params.get("workload");

  // Al llegar desde una fila, el scroll viene del módulo anterior: se sube al
  // aviso para que se lea primero por qué se marcó el workload.
  const top = useRef<HTMLDivElement>(null);
  const focusKey = focus.join(",");
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [focusKey]);

  // Las prácticas en foco van primero; el resto conserva el orden de prioridad.
  const ordered = [
    ...PRACTICES.filter((p) => focus.includes(p.id)),
    ...PRACTICES.filter((p) => !focus.includes(p.id)),
  ];

  return (
    <Flex flexDirection="column" gap={24} padding={32} style={{ maxWidth: 960 }}>
      <div ref={top} />
      <Flex flexDirection="column" gap={8}>
        <Heading level={1}>Kubernetes best practices</Heading>
        <Paragraph>
          The other tabs tell you <Strong>what</Strong> is out of standard. This one explains{" "}
          <Strong>why each rule exists</Strong> and <Strong>how to comply</Strong>, in plain words.
          A rule people understand gets fixed; a red cell nobody can explain gets ignored.
        </Paragraph>
      </Flex>

      {workload && focus.length > 0 && (
        <MessageContainer variant="warning">
          <MessageContainer.Title>Why is {workload} flagged?</MessageContainer.Title>
          <MessageContainer.Description>
            It doesn&apos;t meet {focus.length === 1 ? "this practice" : "these practices"}. They
            are open below, ordered by what to fix first.
          </MessageContainer.Description>
        </MessageContainer>
      )}

      <div
        style={{
          padding: 16,
          background: Colors.Background.Container.Neutral.Default,
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          borderRadius: Borders.Radius.Container.Default,
        }}
      >
        <Flex flexDirection="column" gap={8}>
          <Text textStyle="base-emphasized">How to read the severity</Text>
          {(Object.keys(SEVERITY_META) as Severity[]).map((severity) => (
            <Flex key={severity} gap={12} alignItems="center">
              <span style={{ minWidth: 104 }}>
                <SeverityBadge severity={severity} />
              </span>
              <Text>{SEVERITY_META[severity].meaning}</Text>
            </Flex>
          ))}
        </Flex>
      </div>

      {/* La key reinicia el acordeón cuando cambia el foco (defaultExpanded solo se lee al montar). */}
      <Accordion multiple defaultExpanded={focus} key={focusKey}>
        {ordered.map((practice) => (
          <Accordion.Section key={practice.id} id={practice.id}>
            <Accordion.SectionLabel>
              <Flex gap={12} alignItems="center">
                {/* Siempre ocupa su ancho, para que los títulos queden alineados aunque no haya código. */}
                <Text style={{ color: Colors.Text.Neutral.Subdued, minWidth: 56 }}>
                  {practice.code ?? ""}
                </Text>
                <Text textStyle="base-emphasized">{practice.title}</Text>
                <SeverityBadge severity={practice.severity} />
              </Flex>
            </Accordion.SectionLabel>
            <Accordion.SectionContent>
              <PracticeBody practice={practice} />
            </Accordion.SectionContent>
          </Accordion.Section>
        ))}
      </Accordion>
    </Flex>
  );
};
