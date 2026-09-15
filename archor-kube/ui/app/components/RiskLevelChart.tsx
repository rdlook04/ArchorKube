import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Select } from "@dynatrace/strato-components/forms";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, riskBreakdown } from "../queries/risk";
import type { TierFilterValue } from "./TierFilters";

/** Colores semánticos por nivel de riesgo. */
const LEVEL_COLORS: Record<string, string> = {
  CRITICO: Colors.Background.Container.Critical.Accent,
  ALTO: Colors.Background.Container.Warning.Accent,
  MEDIO: Colors.Background.Container.Neutral.Accent,
};

const DIMENSION_LABEL: Record<BreakdownDimension, string> = {
  tier: "Tier",
  squad: "Squad",
  tribu: "Tribu",
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
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const { data, error, isLoading } = useDql({ query: riskBreakdown(dimension, filters) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? "(sin dato)";
      const nivel = r.nivel ?? "?";
      const workloads = Number(r.workloads ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[nivel] = (bucket[nivel] ?? 0) + workloads;
      byCategory.set(category, bucket);
    }
    return [...byCategory.entries()].map(([category, value]) => ({ category, value }));
  }, [data?.records]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>Riesgo por {DIMENSION_LABEL[dimension].toLowerCase()}</Heading>
        <Select
          aria-label="Agrupar por"
          value={dimension}
          onChange={(value) => value && setDimension(value)}
        >
          <Select.Trigger />
          <Select.Content>
            <Select.Option value="tier">Tier</Select.Option>
            <Select.Option value="squad">Squad</Select.Option>
            <Select.Option value="tribu">Tribu</Select.Option>
          </Select.Content>
        </Select>
      </Flex>
      {isLoading && <ProgressCircle aria-label="Cargando gráfica" />}
      {error && <Paragraph>Error DQL: {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={LEVEL_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={DIMENSION_LABEL[dimension]} />
          <CategoricalBarChart.ValueAxis label="Workloads" />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
