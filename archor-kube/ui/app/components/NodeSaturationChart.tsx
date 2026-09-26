import React, { useMemo } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { nodeSaturation } from "../queries/bottlenecks";
import { useT } from "../i18n";

/** CPU en rojo, MEM en primario (barras agrupadas por nodo). */
const METRIC_COLORS: Record<string, string> = {
  "CPU max %": Colors.Background.Container.Critical.Accent,
  "MEM max %": Colors.Background.Container.Primary.Accent,
};

interface NodeRecord {
  "k8s.node.name"?: string;
  cpu_max?: number;
  mem_max?: number;
}

/**
 * Gráfica complementaria de M11: nodos con saturación de host (CPU o MEM del
 * host sobre 80%). Barras agrupadas CPU max % vs MEM max % por nodo. Es el
 * segundo ángulo de "cuellos de botella" (los nodos no tienen tier).
 */
export const NodeSaturationChart = () => {
  const { t } = useT();
  const c = t.chart;
  const { data, error, isLoading } = useDql({ query: nodeSaturation.build() });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as NodeRecord[];
    return records.map((r) => ({
      category: r["k8s.node.name"] ?? c.noNode,
      value: {
        "CPU max %": Number(r.cpu_max ?? 0),
        "MEM max %": Number(r.mem_max ?? 0),
      },
    }));
  }, [data?.records, c.noNode]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={4}>{c.saturationTitle}</Heading>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && chartData.length === 0 && (
        <Paragraph>{c.noSaturation}</Paragraph>
      )}
      {!isLoading && !error && chartData.length > 0 && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="grouped"
          colorPalette={METRIC_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={c.axis.node} />
          <CategoricalBarChart.ValueAxis label={c.axis.hostUsage} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
