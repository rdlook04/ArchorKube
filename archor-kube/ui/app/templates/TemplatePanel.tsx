import React, { useRef, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Accordion, CodeSnippet } from "@dynatrace/strato-components/content";
import { Flex } from "@dynatrace/strato-components/layouts";
import { List, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import Borders from "@dynatrace/strato-design-tokens/borders";
import { DownloadIcon, RefreshIcon, TableIcon, UploadIcon } from "@dynatrace/strato-icons";

import { useT } from "../i18n";
import { errorMessage } from "../setup/runQuery";
import { downloadText } from "./csv";
import { hasLookup, type LookupId } from "./lookups";
import {
  TEMPLATES,
  buildTemplateCsv,
  parsePattern,
  prepareUpload,
  uploadTemplate,
} from "./templates";

type Outcome = { ok: boolean; text: string; items?: string[] } | null;

/**
 * Una plantilla dentro de Setup: qué es, qué va en cada columna, la descarga
 * con los datos del tenant y las dos formas de subirla (desde aquí o desde
 * Dynatrace). La idea es que nadie tenga que leer documentación para
 * completar un dato que la app pide.
 */
export const TemplatePanel = ({ id }: { id: LookupId }) => {
  const { L, lang } = useT();
  const template = TEMPLATES[id];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [uploaded, setUploaded] = useState(false);
  const loaded = hasLookup(id);

  const download = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      downloadText(template.fileName, await buildTemplateCsv(template));
    } catch (error) {
      setOutcome({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setOutcome(null);
    try {
      const prepared = prepareUpload(template, await file.text(), lang);
      if (prepared.problems.length > 0) {
        setOutcome({
          ok: false,
          text: L({
            en: "Nothing was uploaded. Fix these rows and try again:",
            es: "No se subió nada. Corrige estas filas y vuelve a intentar:",
          }),
          items: prepared.problems.slice(0, 10),
        });
        return;
      }
      await uploadTemplate(template, prepared.csv);
      setUploaded(true);
      setOutcome({
        ok: true,
        text: L({
          en: `${prepared.rows} ${prepared.rows === 1 ? "row" : "rows"} uploaded to ${template.path}. Reload the app so every module uses them.`,
          es: `${prepared.rows} ${prepared.rows === 1 ? "fila subida" : "filas subidas"} a ${template.path}. Recarga la app para que todos los módulos la usen.`,
        }),
      });
    } catch (error) {
      const message = errorMessage(error);
      const permission = /scope|permission|forbidden|403/i.test(message);
      setOutcome({
        ok: false,
        text: permission
          ? L({
              en: `The app can't write to Grail (${message}). Upload it from Dynatrace instead, with the steps below.`,
              es: `La app no puede escribir en Grail (${message}). Súbela desde Dynatrace, con los pasos de abajo.`,
            })
          : message,
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  // Otro color que el resto del chequeo: esto no es información, es algo que
  // la persona completa.
  return (
    <div
      style={{
        marginTop: 8,
        padding: "4px 12px",
        borderRadius: Borders.Radius.Container.Default,
        border: `1px solid ${Colors.Border.Primary.Default}`,
        borderLeft: `4px solid ${Colors.Border.Primary.Accent}`,
        background: Colors.Background.Container.Primary.Default,
      }}
    >
      <Accordion>
        <Accordion.Section id={`${id}-template`}>
          <Accordion.SectionLabel>
            <Flex gap={8} alignItems="center">
              <span style={{ color: Colors.Text.Primary.Default, display: "flex" }}>
                <TableIcon />
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: Colors.Text.Primary.Default,
                }}
              >
                {L({ en: "To complete", es: "Para completar" })}
              </span>
              <span>
                {L({ en: "Template to fill: ", es: "Plantilla para completar: " })}
                {L(template.title)}
              </span>
            </Flex>
          </Accordion.SectionLabel>
          <Accordion.SectionContent>
            <Flex flexDirection="column" gap={12}>
              <Paragraph>{L(template.howItWorks)}</Paragraph>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {loaded
                  ? L({
                      en: `In use: ${template.path} exists in Grail. Download it with your current data, change it and upload it again.`,
                      es: `En uso: ${template.path} existe en Grail. Descárgala con tus datos actuales, cámbiala y vuelve a subirla.`,
                    })
                  : L({
                      en: `Not uploaded yet (${template.path}).`,
                      es: `Todavía no está subida (${template.path}).`,
                    })}
              </Text>

              <Flex flexDirection="column" gap={4}>
                <Strong>{L({ en: "Columns", es: "Columnas" })}</Strong>
                <List>
                  {template.columns.map((c) => (
                    <Text key={c.name} textStyle="small">
                      <Strong>{c.name}</Strong>
                      {c.required ? L({ en: " (required)", es: " (obligatoria)" }) : ""}: {L(c.meaning)}{" "}
                      {L({ en: "Example:", es: "Ejemplo:" })} {c.example}
                    </Text>
                  ))}
                </List>
              </Flex>

              <Flex gap={8} flexWrap="wrap">
                <Button variant="emphasized" onClick={() => void download()} disabled={busy}>
                  <Button.Prefix>
                    <DownloadIcon />
                  </Button.Prefix>
                  {L({ en: "Download with my data (CSV)", es: "Descargar con mis datos (CSV)" })}
                </Button>
                <Button onClick={() => input.current?.click()} disabled={busy}>
                  <Button.Prefix>
                    <UploadIcon />
                  </Button.Prefix>
                  {L({ en: "Upload the completed file", es: "Subir el archivo completado" })}
                </Button>
                {uploaded && (
                  <Button onClick={() => window.location.reload()}>
                    <Button.Prefix>
                      <RefreshIcon />
                    </Button.Prefix>
                    {L({ en: "Reload the app", es: "Recargar la app" })}
                  </Button>
                )}
                <input
                  ref={input}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </Flex>

              {outcome && (
                <Flex flexDirection="column" gap={4}>
                  <Text
                    style={{
                      color: outcome.ok ? Colors.Text.Success.Default : Colors.Text.Critical.Default,
                    }}
                  >
                    {outcome.text}
                  </Text>
                  {outcome.items && (
                    <List>
                      {outcome.items.map((item) => (
                        <Text key={item} textStyle="small">
                          {item}
                        </Text>
                      ))}
                    </List>
                  )}
                </Flex>
              )}

              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {L({
                  en: "Excel, Google Sheets or any editor works; save it as CSV. Columns can be in any order and separated by commas or semicolons.",
                  es: "Sirve Excel, Google Sheets o cualquier editor; guárdalo como CSV. Las columnas pueden ir en cualquier orden y separadas por coma o punto y coma.",
                })}
              </Text>

              <Accordion>
                <Accordion.Section id={`${id}-manual`}>
                  <Accordion.SectionLabel>
                    {L({
                      en: "Or upload it from Dynatrace",
                      es: "O súbela desde Dynatrace",
                    })}
                  </Accordion.SectionLabel>
                  <Accordion.SectionContent>
                    <Flex flexDirection="column" gap={8}>
                      <Paragraph>
                        {L({
                          en: "In Dynatrace, open Settings → Storage management → Grail files and choose Upload. Use a comma-separated CSV, and these values:",
                          es: "En Dynatrace, abre Settings → Storage management → Grail files y elige Upload. Usa un CSV separado por comas, y estos valores:",
                        })}
                      </Paragraph>
                      <Text textStyle="small">{L({ en: "File path", es: "Ruta del archivo (file path)" })}</Text>
                      <CodeSnippet showCopyAction>{template.path}</CodeSnippet>
                      <Text textStyle="small">{L({ en: "Lookup field", es: "Campo de búsqueda (lookup field)" })}</Text>
                      <CodeSnippet showCopyAction>{template.key}</CodeSnippet>
                      <Text textStyle="small">{L({ en: "Parse pattern (DPL)", es: "Patrón de lectura (DPL)" })}</Text>
                      <CodeSnippet showCopyAction>{parsePattern(template)}</CodeSnippet>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                        {L({
                          en: "If it offers to skip the first record, skip it: it's the header. Then reload this app.",
                          es: "Si ofrece saltar el primer registro, sáltalo: es el encabezado. Después recarga esta app.",
                        })}
                      </Text>
                    </Flex>
                  </Accordion.SectionContent>
                </Accordion.Section>
              </Accordion>
            </Flex>
          </Accordion.SectionContent>
        </Accordion.Section>
      </Accordion>
    </div>
  );
};
