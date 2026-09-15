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

/** Colores semánticos por elasticidad (rojo=bloqueado, ámbar=sin margen, verde=OK). */
const ELASTICITY_COLORS: Record<string, string> = {
  BLOQUEADO_NECESITA_MAX: Colors.Background.Container.Critical.Accent,
  SIN_MARGEN_MIN_ES_MAX: Colors.Background.Container.Warning.Accent,
  OK: Colors.Background.Container.Success.Accent,
};

const DIMENSION_LABEL: Record<BreakdownDimension, string> = {
  tier: "Tier",
  squad: "Squad",
  tribu: "Tribu",
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
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const { data, error, isLoading } = useDql({ query: elasticityBreakdown(dimension, filters) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? "(sin dato)";
      const elasticidad = r.elasticidad ?? "?";
      const hpas = Number(r.hpas ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[elasticidad] = (bucket[elasticidad] ?? 0) + hpas;
      byCategory.set(category, bucket);
    }
    return [...byCategory.entries()].map(([category, value]) => ({ category, value }));
  }, [data?.records]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>Elasticidad por {DIMENSION_LABEL[dimension].toLowerCase()}</Heading>
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
          colorPalette={ELASTICITY_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={DIMENSION_LABEL[dimension]} />
          <CategoricalBarChart.ValueAxis label="HPAs" />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
