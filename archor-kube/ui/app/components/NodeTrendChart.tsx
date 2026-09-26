import React from "react";

import { Flex } from "@dynatrace/strato-components/layouts";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { TimeseriesChart, convertToTimeseries } from "@dynatrace/strato-components/charts";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { NODE_TREND_QUERY } from "../queries/spend";
import { useT } from "../i18n";

/**
 * Evolución diaria del número de nodos por clúster en los últimos 30 días.
 *
 * Es la vista que responde "¿el gasto está creciendo?": cada nodo que aparece
 * en la línea es una máquina que se factura mientras exista.
 */
export const NodeTrendChart = () => {
  const { t } = useT();
  const c = t.chart;
  const { data, error, isLoading } = useDql({ query: NODE_TREND_QUERY });

  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={5}>{c.activeNodesPerDay}</Heading>
      {isLoading && <ProgressCircle aria-label={c.loadingTrend} />}
      {error && (
        <Paragraph>
          <Strong>{c.dqlError}</Strong> {error.message}
        </Paragraph>
      )}
      {data?.records && (
        <TimeseriesChart
          data={convertToTimeseries(data.records, data.types)}
          gapPolicy="connect"
          variant="line"
        />
      )}
    </Flex>
  );
};
