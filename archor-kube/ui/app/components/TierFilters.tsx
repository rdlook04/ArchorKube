import React, { useMemo } from "react";

import { Flex } from "@dynatrace/strato-components/layouts";
import { Select } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";

import type { QueryParams } from "../queries";
import { EXTRA_FILTERS } from "../config/extraFilters";
import { useT } from "../i18n";
import type { ExtraFilter } from "../config/extraFilters";
import {
  CLUSTER_FILTER_OPTIONS_QUERY,
  NAMESPACE_FILTER_OPTIONS_QUERY,
  TIER_FILTER_OPTIONS_QUERY,
  extraFilterOptionsQuery,
} from "../queries/tierJoin";

export type TierFilterValue = Pick<
  QueryParams,
  "tier" | "squad" | "tribu" | "cluster" | "namespace" | "extra"
>;

interface TierFiltersProps {
  value: TierFilterValue;
  onChange: (value: TierFilterValue) => void;
}

/**
 * Un filtro opcional por label (`EXTRA_FILTERS` en site.ts). Si la clave no
 * existe en el tenant la consulta de opciones vuelve vacía y el selector no
 * se muestra: un filtro sin valores solo confunde.
 */
const ExtraFilterSelect = ({
  filter,
  value,
  onChange,
}: {
  filter: ExtraFilter;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) => {
  const { t } = useT();
  const { data } = useDql({ query: extraFilterOptionsQuery(filter.key) });
  const values = ((data?.records ?? []) as { value?: string }[])
    .map((r) => r.value)
    .filter((v): v is string => !!v);
  if (values.length === 0) return null;
  return (
    <Select
      aria-label={filter.label}
      clearable
      value={value ?? null}
      onChange={(v) => onChange(v ?? undefined)}
    >
      <Select.Trigger placeholder={t.module.filters.extraAll(filter.label)} />
      <Select.Content>
        {values.map((v) => (
          <Select.Option key={v} value={v}>
            {v}
          </Select.Option>
        ))}
      </Select.Content>
    </Select>
  );
};

/**
 * Selectores transversales: Cluster, Namespace, Tier, Tribu y Squad, más los
 * filtros opcionales por label de `EXTRA_FILTERS`. Las opciones de propiedad
 * salen del proveedor activo, y los selectores se acotan entre sí: elegir
 * tribu reduce los squads, elegir clúster reduce los namespaces.
 */
export const TierFilters = ({ value, onChange }: TierFiltersProps) => {
  const { t } = useT();
  const f = t.module.filters;
  const options = useDql({ query: TIER_FILTER_OPTIONS_QUERY });
  const clusterOptions = useDql({ query: CLUSTER_FILTER_OPTIONS_QUERY });
  const namespaceOptions = useDql({ query: NAMESPACE_FILTER_OPTIONS_QUERY });

  // Los namespaces se acotan al clúster elegido; sin clúster, todos.
  const namespaces = useMemo(() => {
    const records = (namespaceOptions.data?.records ?? []) as {
      namespace?: string;
      cluster?: string;
    }[];
    return [
      ...new Set(
        records
          .filter((r) => !value.cluster || r.cluster === value.cluster)
          .map((r) => r.namespace)
          .filter((n): n is string => !!n),
      ),
    ].sort();
  }, [namespaceOptions.data?.records, value.cluster]);

  const clusters = useMemo(() => {
    const records = (clusterOptions.data?.records ?? []) as { cluster?: string }[];
    return [...new Set(records.map((r) => r.cluster).filter((c): c is string => !!c))].sort();
  }, [clusterOptions.data?.records]);

  const { tiers, squads, tribus } = useMemo(() => {
    const records = (options.data?.records ?? []) as {
      squad?: string;
      tier?: string;
      tribu?: string;
    }[];
    const matches = records.filter(
      (r) =>
        (!value.tier || r.tier === value.tier) &&
        (!value.tribu || r.tribu === value.tribu),
    );
    const uniq = (values: (string | undefined)[]) =>
      [...new Set(values.filter((v): v is string => !!v))].sort();
    return {
      tiers: uniq(records.map((r) => r.tier)),
      tribus: uniq(records.map((r) => r.tribu)),
      squads: uniq(matches.map((r) => r.squad)),
    };
  }, [options.data?.records, value.tier, value.tribu]);

  return (
    <Flex gap={8} flexWrap="wrap">
      <Select
        aria-label={f.cluster}
        clearable
        value={value.cluster ?? null}
        onChange={(cluster) =>
          onChange({ ...value, cluster: cluster ?? undefined, namespace: undefined })
        }
      >
        <Select.Trigger placeholder={f.clusterAll} />
        <Select.Content>
          {clusters.map((c) => (
            <Select.Option key={c} value={c}>
              {c}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      <Select
        aria-label={f.namespace}
        clearable
        value={value.namespace ?? null}
        onChange={(namespace) => onChange({ ...value, namespace: namespace ?? undefined })}
      >
        <Select.Filter />
        <Select.Trigger placeholder={f.namespaceAll} />
        <Select.Content>
          {namespaces.map((n) => (
            <Select.Option key={n} value={n}>
              {n}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      <Select
        aria-label={f.tier}
        clearable
        value={value.tier ?? null}
        onChange={(tier) => onChange({ ...value, tier: tier ?? undefined, squad: undefined })}
      >
        <Select.Trigger placeholder={f.tierAll} />
        <Select.Content>
          {tiers.map((t) => (
            <Select.Option key={t} value={t}>
              {t}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      <Select
        aria-label={f.tribu}
        clearable
        value={value.tribu ?? null}
        onChange={(tribu) => onChange({ ...value, tribu: tribu ?? undefined, squad: undefined })}
      >
        <Select.Trigger placeholder={f.tribuAll} />
        <Select.Content>
          {tribus.map((t) => (
            <Select.Option key={t} value={t}>
              {t}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      <Select
        aria-label={f.squad}
        clearable
        value={value.squad ?? null}
        onChange={(squad) => onChange({ ...value, squad: squad ?? undefined })}
      >
        <Select.Trigger placeholder={f.squadAll} />
        <Select.Content>
          {squads.map((s) => (
            <Select.Option key={s} value={s}>
              {s}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      {EXTRA_FILTERS.map((filter) => (
        <ExtraFilterSelect
          key={filter.id}
          filter={filter}
          value={value.extra?.[filter.id]}
          onChange={(v) => {
            const extra = { ...value.extra };
            if (v) extra[filter.id] = v;
            else delete extra[filter.id];
            onChange({ ...value, extra });
          }}
        />
      ))}
    </Flex>
  );
};
