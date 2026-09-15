import React, { useMemo } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { nodeHealthSummary } from "../queries/controlplane";

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
  const { data, error, isLoading } = useDql({ query: nodeHealthSummary.build() });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as HealthRecord[];
    return records.map((r) => ({
      category: r["k8s.cluster.name"] ?? "(sin clúster)",
      value: {
        Ready: Number(r.nodos_ready ?? 0),
        "Not Ready": Number(r.nodos_not_ready ?? 0),
      },
    }));
  }, [data?.records]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={4}>Salud de nodos por clúster</Heading>
      {isLoading && <ProgressCircle aria-label="Cargando gráfica" />}
      {error && <Paragraph>Error DQL: {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={HEALTH_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label="Clúster" />
          <CategoricalBarChart.ValueAxis label="Nodos" />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
