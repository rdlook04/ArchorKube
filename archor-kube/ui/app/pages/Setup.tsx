import React, { useCallback, useEffect, useState } from "react";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Accordion, CodeSnippet, ProgressCircle } from "@dynatrace/strato-components/content";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, List, Paragraph, Text } from "@dynatrace/strato-components/typography";
import {
  CriticalIcon,
  InformationIcon,
  RefreshIcon,
  SuccessIcon,
  WarningIcon,
} from "@dynatrace/strato-icons";

import { CHECKS, GROUP_LABELS } from "../setup/checks";
import type { CheckGroup, CheckResult, CheckStatus, SetupCheck } from "../setup/checks";
import { errorMessage, runQuery } from "../setup/runQuery";

type Results = Record<string, CheckResult | "running">;

/** Consultas en paralelo, pero pocas a la vez: son 16 y algunas escanean inventario. */
const CONCURRENCY = 4;

const runCheck = async (check: SetupCheck): Promise<CheckResult> => {
  try {
    if (check.kind === "client") return await check.run();
    return check.evaluate(await runQuery(check.query, check.maxRecords));
  } catch (error) {
    const message = errorMessage(error);
    const permission = /scope|permission|forbidden|403|not authorized/i.test(message);
    return {
      status: "fail",
      detail: permission ? `Missing permission: ${message}` : `The check failed: ${message}`,
    };
  }
};

const STATUS_META: Record<CheckStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ok: { label: "OK", color: Colors.Icon.Success.Default, icon: <SuccessIcon /> },
  warn: { label: "Needs attention", color: Colors.Icon.Warning.Default, icon: <WarningIcon /> },
  fail: { label: "Not working", color: Colors.Icon.Critical.Default, icon: <CriticalIcon /> },
  info: { label: "Optional", color: Colors.Icon.Neutral.Default, icon: <InformationIcon /> },
};

const CheckRow = ({ check, result }: { check: SetupCheck; result?: CheckResult | "running" }) => {
  const done = result && result !== "running" ? result : null;
  const meta = done ? STATUS_META[done.status] : null;
  return (
    <div
      style={{
        padding: 16,
        border: `1px solid ${Colors.Border.Neutral.Default}`,
        borderRadius: Borders.Radius.Container.Default,
        background: Colors.Background.Container.Neutral.Default,
      }}
    >
      <Flex gap={12} alignItems="flex-start">
        <span style={{ color: meta?.color, display: "flex", paddingTop: 2, minWidth: 20 }}>
          {meta ? meta.icon : <ProgressCircle size="small" aria-label="Running" />}
        </span>
        <Flex flexDirection="column" gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Flex gap={8} alignItems="baseline" flexWrap="wrap">
            <Text textStyle="base-emphasized">{check.title}</Text>
            {meta && (
              <Text textStyle="small" style={{ color: meta.color }}>
                {meta.label}
              </Text>
            )}
          </Flex>
          {done && <Text>{done.detail}</Text>}
          {done?.items && done.items.length > 0 && (
            <List>
              {done.items.map((item) => (
                <Text key={item} textStyle="small">
                  {item}
                </Text>
              ))}
            </List>
          )}
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Affects: {check.affects.join(", ")}
          </Text>
          {done && done.status !== "ok" && (
            <Accordion>
              <Accordion.Section id={`${check.id}-fix`}>
                <Accordion.SectionLabel>How to fix</Accordion.SectionLabel>
                <Accordion.SectionContent>
                  <Paragraph>{check.fix}</Paragraph>
                  {check.kind === "query" && (
                    <CodeSnippet language="dql" showCopyAction>
                      {check.query}
                    </CodeSnippet>
                  )}
                </Accordion.SectionContent>
              </Accordion.Section>
            </Accordion>
          )}
        </Flex>
      </Flex>
    </div>
  );
};

/**
 * Setup: qué le falta al tenant (o a los archivos de instalación) para que
 * cada módulo funcione. Corre los chequeos de `setup/checks.ts`, todos de
 * solo lectura, y dice qué módulo se ve afectado y cómo arreglarlo.
 */
export const Setup = () => {
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults(Object.fromEntries(CHECKS.map((c) => [c.id, "running" as const])));
    const queue = [...CHECKS];
    const worker = async () => {
      for (let check = queue.shift(); check; check = queue.shift()) {
        const result = await runCheck(check);
        setResults((prev) => ({ ...prev, [check.id]: result }));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }, []);

  useEffect(() => {
    void runAll();
  }, [runAll]);

  const finished = Object.values(results).filter((r): r is CheckResult => r !== "running");
  const tally = (status: CheckStatus) => finished.filter((r) => r.status === status).length;
  const groups = Object.keys(GROUP_LABELS) as CheckGroup[];

  return (
    <Flex flexDirection="column" gap={24} padding={32} style={{ maxWidth: 960 }}>
      <Flex flexDirection="column" gap={8}>
        <Heading level={1}>Setup</Heading>
        <Paragraph>
          What ArchorKube needs from your tenant and your installation files, and which module stops
          working when something is missing. Every check is a read-only query.
        </Paragraph>
      </Flex>

      <Flex gap={24} alignItems="center" flexWrap="wrap">
        {(["ok", "warn", "fail", "info"] as CheckStatus[]).map((status) => (
          <Flex key={status} gap={6} alignItems="center">
            <span style={{ color: STATUS_META[status].color, display: "flex" }}>
              {STATUS_META[status].icon}
            </span>
            <Text>
              {tally(status)} {STATUS_META[status].label.toLowerCase()}
            </Text>
          </Flex>
        ))}
        <div style={{ flex: 1 }} />
        <Button onClick={() => void runAll()} disabled={running}>
          <Button.Prefix>
            <RefreshIcon />
          </Button.Prefix>
          {running ? "Checking…" : "Run again"}
        </Button>
      </Flex>

      {groups.map((group) => (
        <Flex key={group} flexDirection="column" gap={8}>
          <Heading level={2}>{GROUP_LABELS[group]}</Heading>
          {CHECKS.filter((c) => c.group === group).map((check) => (
            <CheckRow key={check.id} check={check} result={results[check.id]} />
          ))}
        </Flex>
      ))}
    </Flex>
  );
};
