import React, { type ReactElement, useCallback, useMemo, useState } from "react";

import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Sheet } from "@dynatrace/strato-components/overlays";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { DataTable, type DataTableColumnDef, useFilteredData } from "@dynatrace/strato-components/tables";
import { FilterBar, type FilterItemValues } from "@dynatrace/strato-components/filters";
import { Select } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";

import type { QueryDef } from "../queries";
import { AnalysisWindowBadge } from "./AnalysisWindowBadge";
import { ModuleAbout, type SimpleExplanation } from "./ModuleAbout";
import { TierFilters, type TierFilterValue } from "./TierFilters";

/** Accessor para campos DQL con punto en el nombre (evita rutas anidadas). */
export const dotted =
  (field: string) =>
  (row: Record<string, unknown>): unknown =>
    row[field];

/** Compone el Markdown del panel para módulos que aún no traen `about` propio. */
const buildAboutMarkdown = (intro?: string, executive?: ExecutiveSummary): string =>
  [
    intro && `## Qué muestra\n\n${intro}`,
    executive?.porQue && `## ¿Por qué debería preocuparme?\n\n${executive.porQue}`,
    executive?.solucion && `## ¿Cómo se soluciona?\n\n${executive.solucion}`,
    executive?.estimacion && `> **Cómo se estimó el dinero:** ${executive.estimacion}`,
  ]
    .filter(Boolean)
    .join("\n\n");

/** Faceta de filtrado del detalle: la columna que clasifica cada hallazgo. */
export interface DetailFacet {
  /** Nombre del campo tal como llega de DQL, ej. "severidad" o "k8s.cluster.name". */
  id: string;
  /** Etiqueta visible del selector. */
  label: string;
  /**
   * Ordena las opciones por el primer número de la etiqueta en vez de como
   * texto. Para rangos ("201 - 400 MB"), donde el orden alfabético pondría
   * "1001 - 1200 MB" antes que "201 - 400 MB".
   */
  numeric?: boolean;
}

/** Texto comparable de una celda: solo los escalares identifican un valor. */
const asText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";

/** Primer número de la etiqueta, para ordenar rangos como "201 - 400 MB". */
const leadingNumber = (value: string): number => {
  const match = /\d+/.exec(value);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
};

/** Valores distintos de un campo, para poblar el selector de la faceta. */
const optionsFor = (
  records: Record<string, unknown>[],
  field: string,
  numeric = false,
): string[] => {
  const values = [
    ...new Set(
      records
        .map((row) => row[field])
        .filter((value): value is string | number => value !== null && value !== undefined)
        .map(String),
    ),
  ];
  return numeric
    ? values.sort((a, b) => leadingNumber(a) - leadingNumber(b) || a.localeCompare(b))
    : values.sort();
};

/** Resumen ejecutivo del módulo: qué responde el jefe de equipo al verlo. */
export interface ExecutiveSummary {
  /** ¿Por qué debería preocuparme? Impacto en negocio/costos/estabilidad. */
  porQue: string;
  /** ¿Cómo se soluciona? Acción concreta para el squad. */
  solucion: string;
  /** Nota sobre cómo se estimó el dinero (supuestos de precio). */
  estimacion?: string;
}

interface ModulePageProps {
  title: string;
  intro?: string;
  /** Bloque ejecutivo "por qué importa / cómo se soluciona" (opt-in). */
  executive?: ExecutiveSummary;
  /**
   * Documento Markdown completo para el panel de detalles. Si se define,
   * reemplaza a intro + executive (que quedan como formato simple).
   */
  about?: string;
  summaryQuery: QueryDef;
  summaryColumns: DataTableColumnDef<Record<string, unknown>>[];
  detailQuery: QueryDef;
  detailColumns: DataTableColumnDef<Record<string, unknown>>[];
  detailMaxRecords?: number;
  /** Texto para el contador de filas del detalle, ej. "workloads". */
  detailNoun: string;
  /** Muestra los selectores transversales tier/squad/tribu (las queries deben aceptar QueryParams). */
  filterable?: boolean;
  /**
   * Explicación sin jerga para quien no administra Kubernetes. Encabeza el
   * panel de detalles, antes del documento técnico.
   */
  simple?: SimpleExplanation;
  /**
   * Columnas de clasificación del detalle que se ofrecen como filtro rápido
   * ("¿qué evento tomó esta fila?"). Filtran del lado del cliente sobre lo ya
   * consultado, así que no re-ejecutan la query.
   */
  detailFacets?: DetailFacet[];
  /** Menú de acciones por fila del detalle (ej. deep links a Dynatrace). */
  rowActions?: (row: Record<string, unknown>) => ReactElement;
  /** Contenido opcional al costado de la tabla resumen (ej. gráfica). Recibe los filtros activos. */
  summaryAside?: (filters: TierFilterValue) => ReactElement;
}

/**
 * Página estándar de módulo ArchorKube: encabezado, botón de actualización,
 * tabla resumen (agrupada por tier/clasificación) y tabla de detalle.
 */
export const ModulePage = ({
  title,
  intro,
  executive,
  about,
  simple,
  summaryQuery,
  summaryColumns,
  detailQuery,
  detailColumns,
  detailMaxRecords = 5000,
  detailNoun,
  filterable = false,
  detailFacets,
  rowActions,
  summaryAside,
}: ModulePageProps) => {
  const [filters, setFilters] = useState<TierFilterValue>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Momento de la última ejecución, para resolver el rango del badge a horas de reloj.
  const [queriedAt, setQueriedAt] = useState(() => new Date());
  const analysisWindow = detailQuery.window ?? summaryQuery.window;
  // useDql refetchea automáticamente cuando cambia el string de la query.
  const summary = useDql({ query: summaryQuery.build(filters) });
  const detail = useDql({
    query: detailQuery.build(filters),
    maxResultRecords: detailMaxRecords,
  });

  const detailRecords = useMemo(
    () => (detail.data?.records ?? []) as Record<string, unknown>[],
    [detail.data?.records],
  );

  // Cada faceta compara el valor elegido contra la celda como texto: DQL
  // devuelve enteros como string y el selector siempre entrega string.
  const matchesFacets = useCallback(
    (applied: FilterItemValues, row: Record<string, unknown>) =>
      Object.entries(applied).every(([field, { value }]) => {
        if (value === undefined || value === null || value === "") return true;
        return asText(row[field]) === asText(value);
      }),
    [],
  );
  const { filteredData, onChange } = useFilteredData(detailRecords, matchesFacets);

  return (
    <Flex flexDirection="column" padding={32} gap={16}>
      <Flex justifyContent="space-between" alignItems="center" gap={16} flexWrap="wrap">
        <Heading level={2}>{title}</Heading>
        <Flex alignItems="center" gap={12}>
          {analysisWindow && (
            <AnalysisWindowBadge window={analysisWindow} queriedAt={queriedAt} />
          )}
          <Button onClick={() => setDetailsOpen((open) => !open)}>Detalles</Button>
        </Flex>
      </Flex>
      {/* La explicación del módulo vive en un overlay: no re-dimensiona la tabla. */}
      <Sheet
        show={detailsOpen}
        title="Acerca de este módulo"
        onDismiss={() => setDetailsOpen(false)}
        actions={<Button onClick={() => setDetailsOpen(false)}>Cerrar</Button>}
      >
        <Flex flexDirection="column" gap={12} padding={16}>
          <ModuleAbout
            simple={simple}
            about={about ?? buildAboutMarkdown(intro, executive)}
            window={analysisWindow}
            queries={[
              { title: summaryQuery.title, dql: summaryQuery.build(filters) },
              { title: detailQuery.title, dql: detailQuery.build(filters) },
            ]}
          />
        </Flex>
      </Sheet>
      <Flex gap={8} alignItems="center">
        {filterable && <TierFilters value={filters} onChange={setFilters} />}
        <Button
          onClick={() => {
            setQueriedAt(new Date());
            void summary.refetch();
            void detail.refetch();
          }}
        >
          Actualizar
        </Button>
      </Flex>

      <Heading level={4}>{summaryQuery.title}</Heading>
      {summary.isLoading && <ProgressCircle aria-label="Cargando resumen" />}
      {summary.error && (
        <Paragraph>
          <Strong>Error DQL:</Strong> {summary.error.message}
        </Paragraph>
      )}
      {summary.data?.records && (
        <Flex gap={16} alignItems="flex-start" flexWrap="wrap">
          <Flex flexDirection="column" style={{ flex: "1 1 480px", minWidth: 0 }}>
            <DataTable data={summary.data.records} columns={summaryColumns} sortable resizable>
              <DataTable.Toolbar>
                <DataTable.DownloadData />
              </DataTable.Toolbar>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          </Flex>
          {summaryAside && (
            <Flex flexDirection="column" style={{ flex: "1 1 420px", minWidth: 0 }}>
              {summaryAside(filters)}
            </Flex>
          )}
        </Flex>
      )}

      <Heading level={4}>{detailQuery.title}</Heading>
      {detail.isLoading && <ProgressCircle aria-label="Cargando detalle" />}
      {detail.error && (
        <Paragraph>
          <Strong>Error DQL:</Strong> {detail.error.message}
        </Paragraph>
      )}
      {detail.data?.records && (
        <>
          {detailFacets && detailRecords.length > 0 && (
            <FilterBar onFilterChange={onChange}>
              {detailFacets.map((facet) => (
                <FilterBar.Item key={facet.id} name={facet.id} label={facet.label}>
                  {/* FilterBar.Item inyecta value/onChange en el Select. */}
                  <Select clearable>
                    <Select.Trigger placeholder="Todos" width="240px" />
                    {/* Los veredictos son largos (SOBREAPROVISIONADO_CPU_MEM):
                        sin ancho propio el desplegable los recorta y quedan
                        opciones indistinguibles. */}
                    <Select.Content width="320px">
                      {optionsFor(detailRecords, facet.id, facet.numeric).map((option) => (
                        <Select.Option key={option} value={option}>
                          {option}
                        </Select.Option>
                      ))}
                    </Select.Content>
                  </Select>
                </FilterBar.Item>
              ))}
            </FilterBar>
          )}
          <Paragraph>
            <Strong>{filteredData.length}</Strong> {detailNoun}
            {filteredData.length !== detailRecords.length && ` (de ${detailRecords.length})`}.
          </Paragraph>
          <DataTable
            data={filteredData}
            columns={detailColumns}
            sortable
            resizable
            fullWidth
            lineWrap
          >
            <DataTable.Toolbar>
              <DataTable.ColumnSettingsTrigger />
              <DataTable.VisibilitySettings />
              <DataTable.ColumnOrderSettings />
              <DataTable.DownloadData />
              <DataTable.LineWrap />
            </DataTable.Toolbar>
            {rowActions && (
              <DataTable.RowActions>
                {(row) => rowActions(row as Record<string, unknown>)}
              </DataTable.RowActions>
            )}
            <DataTable.Pagination defaultPageSize={20} />
          </DataTable>
        </>
      )}
    </Flex>
  );
};
