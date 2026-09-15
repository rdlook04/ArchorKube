import React, { useMemo } from "react";

import { Flex } from "@dynatrace/strato-components/layouts";
import { Select } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";

import type { QueryParams } from "../queries";
import {
  CLUSTER_FILTER_OPTIONS_QUERY,
  TIER_FILTER_OPTIONS_QUERY,
} from "../queries/tierJoin";

export type TierFilterValue = Pick<QueryParams, "tier" | "squad" | "tribu" | "cluster">;

interface TierFiltersProps {
  value: TierFilterValue;
  onChange: (value: TierFilterValue) => void;
}

/**
 * Selectores transversales Tier / Squad / Tribu. Las opciones salen del
 * catálogo de propiedad activo. Los selectores se acotan entre sí:
 * elegir tribu reduce los squads, elegir tier reduce squads y tribus.
 */
export const TierFilters = ({ value, onChange }: TierFiltersProps) => {
  const options = useDql({ query: TIER_FILTER_OPTIONS_QUERY });
  const clusterOptions = useDql({ query: CLUSTER_FILTER_OPTIONS_QUERY });

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
    <Flex gap={8}>
      <Select
        aria-label="Cluster"
        clearable
        value={value.cluster ?? null}
        onChange={(cluster) => onChange({ ...value, cluster: cluster ?? undefined })}
      >
        <Select.Trigger placeholder="Cluster: todos" />
        <Select.Content>
          {clusters.map((c) => (
            <Select.Option key={c} value={c}>
              {c}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      <Select
        aria-label="Tier"
        clearable
        value={value.tier ?? null}
        onChange={(tier) => onChange({ ...value, tier: tier ?? undefined, squad: undefined })}
      >
        <Select.Trigger placeholder="Tier: todos" />
        <Select.Content>
          {tiers.map((t) => (
            <Select.Option key={t} value={t}>
              {t}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      <Select
        aria-label="Tribu"
        clearable
        value={value.tribu ?? null}
        onChange={(tribu) => onChange({ ...value, tribu: tribu ?? undefined, squad: undefined })}
      >
        <Select.Trigger placeholder="Tribu: todas" />
        <Select.Content>
          {tribus.map((t) => (
            <Select.Option key={t} value={t}>
              {t}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
      <Select
        aria-label="Squad"
        clearable
        value={value.squad ?? null}
        onChange={(squad) => onChange({ ...value, squad: squad ?? undefined })}
      >
        <Select.Trigger placeholder="Squad: todos" />
        <Select.Content>
          {squads.map((s) => (
            <Select.Option key={s} value={s}>
              {s}
            </Select.Option>
          ))}
        </Select.Content>
      </Select>
    </Flex>
  );
};
