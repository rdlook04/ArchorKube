import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, riskBreakdown } from "../queries/risk";
import type { TierFilterValue } from "./TierFilters";
import { useT } from "../i18n";
import { DimensionSelect, keepTopBars, useDimensionName } from "./DimensionSelect";

/** Colores semánticos por nivel de riesgo. */
const LEVEL_COLORS: Record<string, string> = {
  CRITICO: Colors.Background.Container.Critical.Accent,
  ALTO: Colors.Background.Container.Warning.Accent,
  MEDIO: Colors.Background.Container.Neutral.Accent,
};

interface BreakdownRecord {
  category?: string;
  nivel?: string;
  workloads?: number;
}

/**
 * Gráfica categórica apilada: workloads por nivel de riesgo, agrupados por la
 * dimensión elegida (tier/squad/tribu). Cada barra es una categoría; cada
 * segmento, un nivel con su color semántico.
 */
export const RiskLevelChart = ({ filters }: { filters: TierFilterValue }) => {
  const { t, lang } = useT();
  const c = t.chart;
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const dimensionName = useDimensionName();
  const { data, error, isLoading } = useDql({ query: riskBreakdown(dimension, { ...filters, lang }) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? c.noData;
      const nivel = r.nivel ?? "?";
      const workloads = Number(r.workloads ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[nivel] = (bucket[nivel] ?? 0) + workloads;
      byCategory.set(category, bucket);
    }
    return keepTopBars(
      [...byCategory.entries()].map(([category, value]) => ({ category, value })),
      c.others,
    );
  }, [data?.records, c.noData, c.others]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>{c.by(c.nouns.risk, dimensionName(dimension))}</Heading>
        <DimensionSelect value={dimension} onChange={setDimension} />
      </Flex>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={LEVEL_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={dimensionName(dimension)} />
          <CategoricalBarChart.ValueAxis label={c.axis.workloads} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
