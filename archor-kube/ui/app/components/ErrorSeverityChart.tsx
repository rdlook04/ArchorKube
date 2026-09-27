import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, errorSeverityBreakdown } from "../queries/errors";
import type { TierFilterValue } from "./TierFilters";
import { useT } from "../i18n";
import { DimensionSelect, keepTopBars, useDimensionName } from "./DimensionSelect";

/** Colores semánticos por severidad (rojo=con críticos, ámbar=solo errores). */
const SEVERITY_COLORS: Record<string, string> = {
  CON_CRITICOS: Colors.Background.Container.Critical.Accent,
  SOLO_ERRORES: Colors.Background.Container.Warning.Accent,
};

interface BreakdownRecord {
  category?: string;
  severidad?: string;
  contenedores?: number;
}

/**
 * Gráfica categórica apilada: contenedores por severidad, agrupados por la
 * dimensión elegida (tier/squad/tribu).
 */
export const ErrorSeverityChart = ({ filters }: { filters: TierFilterValue }) => {
  const { t, lang } = useT();
  const c = t.chart;
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const dimensionName = useDimensionName();
  const { data, error, isLoading } = useDql({ query: errorSeverityBreakdown(dimension, { ...filters, lang }) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? c.noData;
      const severidad = r.severidad ?? "?";
      const contenedores = Number(r.contenedores ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[severidad] = (bucket[severidad] ?? 0) + contenedores;
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
        <Heading level={4}>{c.by(c.nouns.severity, dimensionName(dimension))}</Heading>
        <DimensionSelect value={dimension} onChange={setDimension} />
      </Flex>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={SEVERITY_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={dimensionName(dimension)} />
          <CategoricalBarChart.ValueAxis label={c.axis.containers} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
