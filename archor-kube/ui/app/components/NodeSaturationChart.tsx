import React, { useMemo } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { nodeSaturation } from "../queries/bottlenecks";

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
  const { data, error, isLoading } = useDql({ query: nodeSaturation.build() });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as NodeRecord[];
    return records.map((r) => ({
      category: r["k8s.node.name"] ?? "(sin nodo)",
      value: {
        "CPU max %": Number(r.cpu_max ?? 0),
        "MEM max %": Number(r.mem_max ?? 0),
      },
    }));
  }, [data?.records]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={4}>Saturación de nodos (host CPU/MEM &gt; 80%)</Heading>
      {isLoading && <ProgressCircle aria-label="Cargando gráfica" />}
      {error && <Paragraph>Error DQL: {error.message}</Paragraph>}
      {!isLoading && !error && chartData.length === 0 && (
        <Paragraph>Ningún nodo supera el 80% de CPU o memoria del host.</Paragraph>
      )}
      {!isLoading && !error && chartData.length > 0 && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="grouped"
          colorPalette={METRIC_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label="Nodo" />
          <CategoricalBarChart.ValueAxis label="% uso host" />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
