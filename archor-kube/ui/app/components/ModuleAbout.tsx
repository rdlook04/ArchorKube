import React from "react";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Accordion, Markdown } from "@dynatrace/strato-components/content";
import { DQLEditor } from "@dynatrace/strato-components/editors";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";

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

/**
 * Glosario de los términos que se repiten en las tablas de todos los módulos.
 * Vive aquí, compartido, en vez de repetirse en cada `about`.
 */
const GLOSSARY: { term: string; meaning: string }[] = [
  {
    term: "Clúster",
    meaning:
      "El conjunto de máquinas donde corren las aplicaciones. Puede haber varios (por ejemplo uno de producción y otro de no-producción).",
  },
  {
    term: "Nodo",
    meaning:
      "Una de esas máquinas (un servidor). El clúster reparte las aplicaciones entre sus nodos.",
  },
  {
    term: "Pod",
    meaning:
      "Una copia en ejecución de una aplicación. Si una aplicación tiene 3 copias para aguantar la carga, son 3 pods.",
  },
  {
    term: "Workload",
    meaning:
      "La aplicación como tal, con todas sus copias. Es lo que un squad reconoce como 'su servicio'.",
  },
  {
    term: "Namespace",
    meaning:
      "Una carpeta dentro del clúster que agrupa aplicaciones relacionadas y las mantiene separadas de las demás.",
  },
  {
    term: "Request (reserva)",
    meaning:
      "La cantidad de CPU y memoria que la aplicación pide reservada para sí. Se paga se use o no: es la base del cálculo de desperdicio.",
  },
  {
    term: "Limit (tope)",
    meaning:
      "El máximo de CPU y memoria que la aplicación puede llegar a usar. Si lo toca, el sistema la frena o la reinicia.",
  },
  {
    term: "Throttling (frenado)",
    meaning:
      "Cuando una aplicación pide más CPU de la que su tope permite, el sistema la ralentiza a propósito. Se siente como lentitud para el usuario final.",
  },
  {
    term: "OOM kill",
    meaning:
      "El sistema mata la aplicación porque se quedó sin memoria. Se cae y vuelve a arrancar, perdiendo lo que estaba haciendo.",
  },
  {
    term: "Probe (chequeo de salud)",
    meaning:
      "Una revisión automática que pregunta '¿sigues viva?' y '¿ya puedes atender?'. Sin ella, el sistema manda tráfico a copias que no responden.",
  },
  {
    term: "Réplica",
    meaning:
      "Cada copia de la aplicación. Con una sola, cualquier falla la deja fuera de servicio; con varias, las otras siguen atendiendo.",
  },
  {
    term: "HPA (autoescalado)",
    meaning:
      "El mecanismo que agrega o quita copias solo, según la carga. Si llega a su máximo, ya no puede crecer más aunque haga falta.",
  },
  {
    term: "Tier",
    meaning:
      "Qué tan crítica es la aplicación para el negocio, según el catálogo de propiedad. Tier 1 es lo más crítico.",
  },
  {
    term: "Squad / Tribu",
    meaning:
      "El equipo dueño de la aplicación y el área a la que pertenece. Sirve para saber a quién le toca actuar.",
  },
  {
    term: "Grail / DQL",
    meaning:
      "Grail es la base de datos de Dynatrace donde se guarda todo lo observado, y DQL el lenguaje con el que se le pregunta. Cada número de esta app sale de una consulta DQL en vivo.",
  },
];

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
export const ModuleAbout = ({ simple, about, window, queries }: ModuleAboutProps) => (
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
          En palabras simples
        </Heading>
        <SimpleAnswer question="¿Qué estoy viendo?" answer={simple.que} />
        <SimpleAnswer question="¿Por qué me importa?" answer={simple.porque} />
        <SimpleAnswer question="¿Qué hago con esto?" answer={simple.accion} />
      </Flex>
    )}

    <Markdown>{about}</Markdown>

    {window && (
      <Flex flexDirection="column" gap={4}>
        <Heading level={5}>Ventana de análisis</Heading>
        <Paragraph>
          <Text style={{ fontWeight: 700 }}>{window.label}.</Text> {window.detail}
        </Paragraph>
      </Flex>
    )}

    <Accordion multiple>
      <Accordion.Section id="glosario">
        <Accordion.SectionLabel>Glosario: ¿qué significa cada término?</Accordion.SectionLabel>
        <Accordion.SectionContent>
          <Flex flexDirection="column" gap={12} paddingTop={8}>
            {GLOSSARY.map((entry) => (
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
        <Accordion.SectionLabel>
          Consulta que se ejecutó (para el equipo técnico)
        </Accordion.SectionLabel>
        <Accordion.SectionContent>
          <Flex flexDirection="column" gap={12} paddingTop={8}>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>
              Este es el DQL exacto que produjo las tablas de arriba, con los filtros que tengas
              puestos ya aplicados. Puedes copiarlo y ejecutarlo en un notebook de Dynatrace para
              verificar cualquier número.
            </Text>
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
