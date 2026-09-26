import React, { useMemo } from "react";

import Colors from "@dynatrace/strato-design-tokens/colors";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { CategoricalBarChartData } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { nodeActionBreakdown } from "../queries/density";
import type { TierFilterValue } from "./TierFilters";
import { useT } from "../i18n";

/** Colores semánticos por acción (verde=eliminar/ahorro, ámbar=consolidar, gris=monitorear). */
const ACTION_COLORS: Record<string, string> = {
  CANDIDATO_ELIMINAR: Colors.Background.Container.Success.Accent,
  CONSOLIDAR_SI_ES_POSIBLE: Colors.Background.Container.Warning.Accent,
  MONITOREAR: Colors.Background.Container.Neutral.Accent,
};

interface BreakdownRecord {
  category?: string;
  accion?: string;
  nodos?: number;
}

/**
 * Gráfica categórica apilada: nodos por acción sugerida, agrupados por clúster.
 * Los nodos no tienen tier/squad/tribu, así que la dimensión es fija (clúster)
 * y no hay selector.
 */
export const NodeActionChart = ({ filters }: { filters: TierFilterValue }) => {
  const { t } = useT();
  const c = t.chart;
  const { data, error, isLoading } = useDql({ query: nodeActionBreakdown(filters) });

  const chartData = useMemo<CategoricalBarChartData[]>(() => {
    const records = (data?.records ?? []) as BreakdownRecord[];
    const byCategory = new Map<string, Record<string, number>>();
    for (const r of records) {
      const category = r.category ?? c.noCluster;
      const accion = r.accion ?? "?";
      const nodos = Number(r.nodos ?? 0);
      const bucket = byCategory.get(category) ?? {};
      bucket[accion] = (bucket[accion] ?? 0) + nodos;
      byCategory.set(category, bucket);
    }
    return [...byCategory.entries()].map(([category, value]) => ({ category, value }));
  }, [data?.records, c.noCluster]);

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={4}>{c.nodesByAction}</Heading>
      {isLoading && <ProgressCircle aria-label={c.loading} />}
      {error && <Paragraph>{c.dqlError} {error.message}</Paragraph>}
      {!isLoading && !error && (
        <CategoricalBarChart
          data={chartData}
          layout="horizontal"
          groupMode="stacked"
          colorPalette={ACTION_COLORS}
          height={340}
        >
          <CategoricalBarChart.CategoryAxis label={c.axis.cluster} />
          <CategoricalBarChart.ValueAxis label={c.axis.nodes} />
          <CategoricalBarChart.Legend position="bottom" />
        </CategoricalBarChart>
      )}
    </Flex>
  );
};
