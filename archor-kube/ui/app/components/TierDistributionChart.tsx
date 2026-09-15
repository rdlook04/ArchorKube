import React, { useMemo } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { tierDistribution } from "../queries/tiering";

const REPO_COLORS: Record<string, string> = {
  Repos: Colors.Background.Container.Primary.Accent,
};

interface DistRecord {
  category?: string;
  repos?: number;
}

/**
 * Gráfica de inventario: cantidad de repositorios del catálogo de propiedad por tier.
 * Dimensión fija (tier); es un catálogo, no un módulo de hallazgos.
 */
export const TierDistributionChart = () => {
  const { data, error, isLoading } = useDql({ query: tierDistribution.build() });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as DistRecord[];
    return records.map((r) => ({
      category: r.category ?? "(sin tier)",
      value: { Repos: Number(r.repos ?? 0) },
    }));
  }, [data?.records]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={4}>Repositorios por tier</Heading>
      {isLoading && <ProgressCircle aria-label="Cargando gráfica" />}
      {error && <Paragraph>Error DQL: {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={REPO_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label="Tier" />
          <CategoricalBarChart.ValueAxis label="Repos" />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
