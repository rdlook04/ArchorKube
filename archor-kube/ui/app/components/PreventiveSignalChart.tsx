import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Select } from "@dynatrace/strato-components/forms";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, preventiveBreakdown } from "../queries/preventive";
import type { TierFilterValue } from "./TierFilters";

/** Colores semánticos por señal (rojo=OOM, ámbar=restart loop, gris=restarts elevados). */
const SIGNAL_COLORS: Record<string, string> = {
  OOM_KILL: Colors.Background.Container.Critical.Accent,
  RESTART_LOOP: Colors.Background.Container.Warning.Accent,
  RESTARTS_ELEVADOS: Colors.Background.Container.Neutral.Accent,
};

const DIMENSION_LABEL: Record<BreakdownDimension, string> = {
  tier: "Tier",
  squad: "Squad",
  tribu: "Tribu",
};

interface BreakdownRecord {
  category?: string;
  senal?: string;
  workloads?: number;
}

/**
 * Gráfica categórica apilada: workloads por señal preventiva, agrupados por la
 * dimensión elegida (tier/squad/tribu). Cada barra es una categoría; cada
 * segmento, una señal con su color semántico.
 */
export const PreventiveSignalChart = ({ filters }: { filters: TierFilterValue }) => {
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const { data, error, isLoading } = useDql({ query: preventiveBreakdown(dimension, filters) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? "(sin dato)";
      const senal = r.senal ?? "?";
      const workloads = Number(r.workloads ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[senal] = (bucket[senal] ?? 0) + workloads;
      byCategory.set(category, bucket);
    }
    return [...byCategory.entries()].map(([category, value]) => ({ category, value }));
  }, [data?.records]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>Señales por {DIMENSION_LABEL[dimension].toLowerCase()}</Heading>
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
          colorPalette={SIGNAL_COLORS}
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
