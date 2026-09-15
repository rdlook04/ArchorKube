import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Select } from "@dynatrace/strato-components/forms";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, rightsizingBreakdown } from "../queries/rightsizing";
import type { TierFilterValue } from "./TierFilters";

/** Colores semánticos por problema (rojo=riesgo, ámbar=subdimensionado, resto=desperdicio). */
const PROBLEM_COLORS: Record<string, string> = {
  THROTTLING_CRITICO: Colors.Background.Container.Critical.Accent,
  REQUEST_SUBDIMENSIONADO: Colors.Background.Container.Warning.Accent,
  SOBREAPROVISIONADO_CPU_MEM: Colors.Background.Container.Primary.Accent,
  SOBREAPROVISIONADO_CPU: Colors.Background.Container.Success.Accent,
  SOBREAPROVISIONADO_MEM: Colors.Background.Container.Neutral.Accent,
};

const DIMENSION_LABEL: Record<BreakdownDimension, string> = {
  tier: "Tier",
  squad: "Squad",
  tribu: "Tribu",
};

interface BreakdownRecord {
  category?: string;
  problema?: string;
  pods?: number;
}

/**
 * Gráfica categórica apilada: pods por problema de rightsizing, agrupados por
 * la dimensión elegida (tier/squad/tribu). Cada barra es una categoría; cada
 * segmento, un tipo de problema con su color semántico.
 */
export const RightsizingProblemChart = ({ filters }: { filters: TierFilterValue }) => {
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const { data, error, isLoading } = useDql({ query: rightsizingBreakdown(dimension, filters) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? "(sin dato)";
      const problema = r.problema ?? "?";
      const pods = Number(r.pods ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[problema] = (bucket[problema] ?? 0) + pods;
      byCategory.set(category, bucket);
    }
    return [...byCategory.entries()].map(([category, value]) => ({ category, value }));
  }, [data?.records]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>Problemas por {DIMENSION_LABEL[dimension].toLowerCase()}</Heading>
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
          colorPalette={PROBLEM_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={DIMENSION_LABEL[dimension]} />
          <CategoricalBarChart.ValueAxis label="Pods" />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
