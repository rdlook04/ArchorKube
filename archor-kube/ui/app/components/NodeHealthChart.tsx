import React, { useMemo } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { nodeHealthSummary } from "../queries/controlplane";
import { useT } from "../i18n";

/** Verde = Ready, rojo = Not Ready. */
const HEALTH_COLORS: Record<string, string> = {
  Ready: Colors.Background.Container.Success.Accent,
  "Not Ready": Colors.Background.Container.Critical.Accent,
};

interface HealthRecord {
  "k8s.cluster.name"?: string;
  nodos_ready?: number;
  nodos_not_ready?: number;
}

/**
 * Gráfica de salud de nodos por clúster: barra apilada Ready vs Not Ready.
 * Los nodos no tienen tier, así que la dimensión es fija (clúster).
 */
export const NodeHealthChart = () => {
  const { t } = useT();
  const c = t.chart;
  const { data, error, isLoading } = useDql({ query: nodeHealthSummary.build() });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as HealthRecord[];
    return records.map((r) => ({
      category: r["k8s.cluster.name"] ?? c.noCluster,
      value: {
        Ready: Number(r.nodos_ready ?? 0),
        "Not Ready": Number(r.nodos_not_ready ?? 0),
      },
    }));
  }, [data?.records, c.noCluster]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={4}>{c.nodeHealthTitle}</Heading>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={HEALTH_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={c.axis.cluster} />
          <CategoricalBarChart.ValueAxis label={c.axis.nodes} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
