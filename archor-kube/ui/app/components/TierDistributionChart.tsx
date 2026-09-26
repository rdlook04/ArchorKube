import React, { useMemo } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { tierDistribution } from "../queries/tiering";
import { useT } from "../i18n";

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
  const { t } = useT();
  const c = t.chart;
  const { data, error, isLoading } = useDql({ query: tierDistribution.build() });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as DistRecord[];
    return records.map((r) => ({
      category: r.category ?? c.noTier,
      value: { Repos: Number(r.repos ?? 0) },
    }));
  }, [data?.records, c.noTier]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={4}>{c.reposByTier}</Heading>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={REPO_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={c.axis.tier} />
          <CategoricalBarChart.ValueAxis label={c.axis.repos} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
