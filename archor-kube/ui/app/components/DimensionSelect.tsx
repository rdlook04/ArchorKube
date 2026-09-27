import React, { useCallback } from "react";

import { Select } from "@dynatrace/strato-components/forms";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";

import { CHART_DIMENSIONS, type ChartDimension, labelDimensionName } from "../queries/dimensions";
import { useT } from "../i18n";

/** Nombre visible de un eje: los fijos salen del diccionario; los de `site.ts`, de su label. */
export const useDimensionName = () => {
  const { t, lang } = useT();
  return useCallback(
    (dimension: string): string =>
      labelDimensionName(dimension, lang) ?? t.chart.dimension[dimension] ?? dimension,
    [t, lang],
  );
};

interface DimensionSelectProps<E extends string> {
  value: ChartDimension | NoInfer<E>;
  onChange: (dimension: ChartDimension | NoInfer<E>) => void;
  /** Ejes propios del módulo, al final de la lista (ej. bandas de memoria en Ociosos). */
  extra?: E[];
}

/** Selector "agrupar por" de las gráficas: los ejes compartidos más los del módulo. */
export const DimensionSelect = <E extends string = never>({
  value,
  onChange,
  extra = [],
}: DimensionSelectProps<E>) => {
  const { t } = useT();
  const dimensionName = useDimensionName();
  const options: (ChartDimension | E)[] = [...CHART_DIMENSIONS, ...extra];
  return (
    <Select<ChartDimension | E>
      aria-label={t.chart.groupBy}
      value={value}
      onChange={(next) => next && onChange(next)}
    >
      <Select.Trigger />
      <Select.Content>
        {options.map((dimension) => (
          <Select.Option key={dimension} value={dimension}>
            {dimensionName(dimension)}
          </Select.Option>
        ))}
      </Select.Content>
    </Select>
  );
};

/** Más barras que esto no se leen en el alto de la gráfica. */
const MAX_BARS = 15;

/**
 * Con ejes de muchos valores (namespace, squad) la gráfica se vuelve ilegible.
 * Si hay más de MAX_BARS categorías, quedan las de mayor total y el resto se
 * suma en una barra "(otros N)"; con pocas, el orden de la consulta se respeta.
 */
export const keepTopBars = (
  bars: { category: string; value: Record<string, number> }[],
  othersLabel: (count: number) => string,
): CategoricalBarChartData[] => {
  if (bars.length <= MAX_BARS) return bars;
  const total = (value: Record<string, number>) =>
    Object.values(value).reduce((sum, n) => sum + n, 0);
  const sorted = [...bars].sort((a, b) => total(b.value) - total(a.value));
  const rest = sorted.slice(MAX_BARS);
  const others: Record<string, number> = {};
  for (const bar of rest) {
    for (const [segment, n] of Object.entries(bar.value)) others[segment] = (others[segment] ?? 0) + n;
  }
  return [...sorted.slice(0, MAX_BARS), { category: othersLabel(rest.length), value: others }];
};
