import React, { useMemo, useState } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { type BreakdownDimension, preventiveBreakdown } from "../queries/preventive";
import type { TierFilterValue } from "./TierFilters";
import { useT } from "../i18n";
import { codeLabel, labelPalette } from "../i18n/codes";
import { DimensionSelect, keepTopBars, useDimensionName } from "./DimensionSelect";

/** Colores semánticos por señal (rojo=OOM, ámbar=restart loop, gris=restarts elevados). */
const SIGNAL_COLORS: Record<string, string> = {
  OOM_KILL: Colors.Background.Container.Critical.Accent,
  RESTART_LOOP: Colors.Background.Container.Warning.Accent,
  RESTARTS_ELEVADOS: Colors.Background.Container.Neutral.Accent,
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
  const { t, lang } = useT();
  const c = t.chart;
  const [dimension, setDimension] = useState<BreakdownDimension>("tier");
  const dimensionName = useDimensionName();
  const { data, error, isLoading } = useDql({ query: preventiveBreakdown(dimension, { ...filters, lang }) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? c.noData;
      const senal = codeLabel(r.senal ?? "?", lang);
      const workloads = Number(r.workloads ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[senal] = (bucket[senal] ?? 0) + workloads;
      byCategory.set(category, bucket);
    }
    return keepTopBars(
      [...byCategory.entries()].map(([category, value]) => ({ category, value })),
      c.others,
    );
  }, [data?.records, c.noData, c.others, lang]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex justifyContent="space-between" alignItems="center" gap={8}>
        <Heading level={4}>{c.by(c.nouns.signals, dimensionName(dimension))}</Heading>
        <DimensionSelect value={dimension} onChange={setDimension} />
      </Flex>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={labelPalette(SIGNAL_COLORS, lang)}
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
