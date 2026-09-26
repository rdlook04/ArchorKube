import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Select } from "@dynatrace/strato-components/forms";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, elasticityBreakdown } from "../queries/elasticity";
import type { TierFilterValue } from "./TierFilters";
import { useT } from "../i18n";

/** Colores semánticos por elasticidad (rojo=bloqueado, ámbar=sin margen, verde=OK). */
const ELASTICITY_COLORS: Record<string, string> = {
  BLOQUEADO_NECESITA_MAX: Colors.Background.Container.Critical.Accent,
  SIN_MARGEN_MIN_ES_MAX: Colors.Background.Container.Warning.Accent,
  OK: Colors.Background.Container.Success.Accent,
};

interface BreakdownRecord {
  category?: string;
  elasticidad?: string;
  hpas?: number;
}

/**
 * Gráfica categórica apilada: HPAs por estado de elasticidad, agrupados por la
 * dimensión elegida (tier/squad/tribu).
 */
export const ElasticityChart = ({ filters }: { filters: TierFilterValue }) => {
  const { t } = useT();
  const c = t.chart;
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const { data, error, isLoading } = useDql({ query: elasticityBreakdown(dimension, filters) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? c.noData;
      const elasticidad = r.elasticidad ?? "?";
      const hpas = Number(r.hpas ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[elasticidad] = (bucket[elasticidad] ?? 0) + hpas;
      byCategory.set(category, bucket);
    }
    return [...byCategory.entries()].map(([category, value]) => ({ category, value }));
  }, [data?.records, c.noData]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>{c.by(c.nouns.elasticity, c.dimension[dimension])}</Heading>
        <Select
          aria-label={c.groupBy}
          value={dimension}
          onChange={(value) => value && setDimension(value)}
        >
          <Select.Trigger />
          <Select.Content>
            <Select.Option value="tier">{c.dimension.tier}</Select.Option>
            <Select.Option value="squad">{c.dimension.squad}</Select.Option>
            <Select.Option value="tribu">{c.dimension.tribu}</Select.Option>
          </Select.Content>
        </Select>
      </Flex>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={ELASTICITY_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={c.dimension[dimension]} />
          <CategoricalBarChart.ValueAxis label={c.axis.hpas} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
