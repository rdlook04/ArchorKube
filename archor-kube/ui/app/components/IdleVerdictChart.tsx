import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Select } from "@dynatrace/strato-components/forms";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, idleBreakdown } from "../queries/idle";
import type { TierFilterValue } from "./TierFilters";
import { useT } from "../i18n";

/** Colores semánticos por veredicto (mismo criterio que los highlights de la tabla). */
const VERDICT_COLORS: Record<string, string> = {
  OCIOSO_CONFIRMADO: Colors.Background.Container.Success.Accent,
  OCIOSO_SIN_DATO_APM: Colors.Background.Container.Warning.Accent,
  DESCARTADO_INESTABLE: Colors.Background.Container.Critical.Accent,
  DESCARTADO_CON_TRAFICO: Colors.Background.Container.Neutral.Accent,
};

interface BreakdownRecord {
  category?: string;
  veredicto?: string;
  workloads?: number;
}

/**
 * Gráfica categórica apilada: workloads por veredicto de la Regla de Oro,
 * agrupados por la dimensión elegida (tier/squad/tribu, banda de memoria
 * reservada de 200 MB, o qué fracción de esa reserva se ocupa). Cada barra es
 * una categoría; cada segmento, un veredicto con su color semántico.
 */
export const IdleVerdictChart = ({ filters }: { filters: TierFilterValue }) => {
  const { t, lang } = useT();
  const c = t.chart;
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const { data, error, isLoading } = useDql({ query: idleBreakdown(dimension, { ...filters, lang }) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? c.noData;
      const veredicto = r.veredicto ?? "?";
      const workloads = Number(r.workloads ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[veredicto] = (bucket[veredicto] ?? 0) + workloads;
      byCategory.set(category, bucket);
    }
    return [...byCategory.entries()].map(([category, value]) => ({ category, value }));
  }, [data?.records, c.noData]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>{c.by(c.nouns.verdicts, c.dimension[dimension])}</Heading>
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
            <Select.Option value="rango_mem">{c.dimension.rango_mem}</Select.Option>
            <Select.Option value="uso_vs_reserva">{c.dimension.uso_vs_reserva}</Select.Option>
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
          colorPalette={VERDICT_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={c.dimension[dimension]} />
          <CategoricalBarChart.ValueAxis label={c.axis.workloads} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
