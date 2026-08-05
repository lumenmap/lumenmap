export type Period = "1d" | "7d" | "30d" | "month";

export type DataSource = "hubble";

/** Stable identifiers used by the public treemap contract. */
export type MetricId =
  | "operation_count"
  | "transaction_count"
  | "asset_volume"
  | "tvl";

/** Internal selector values for the two metrics currently backed by queries. */
export type DashboardMetricId = "ops" | "xlm_volume";

export type CountUnit =
  | { kind: "count"; subject: "operation" }
  | { kind: "count"; subject: "transaction" };

export type AssetIdentity =
  | { type: "native"; code: "XLM" }
  | { type: "issued"; code: string; issuer: string };

export type AssetUnit = { kind: "asset"; asset: AssetIdentity };

/**
 * A discriminated metric contract keeps identifiers, serialized values, and
 * units coupled. Asset amounts are strings so consumers cannot accidentally
 * treat them as count values.
 */
export type MetricContract =
  | {
      metric: "operation_count";
      value: number;
      unit: { kind: "count"; subject: "operation" };
    }
  | {
      metric: "transaction_count";
      value: number;
      unit: { kind: "count"; subject: "transaction" };
    }
  | { metric: "asset_volume"; value: string; unit: AssetUnit }
  | { metric: "tvl"; value: string; unit: AssetUnit };

type MetricVariant<M extends MetricId> = Extract<MetricContract, { metric: M }>;

export type MetricValue<M extends MetricId> = MetricVariant<M>["value"];
export type MetricUnit<M extends MetricId> = MetricVariant<M>["unit"];

export type MetricMethodology = {
  operation_count: {
    id: "operations";
    version: "1.0.0";
    href: "docs/metric-methodology.md#operations";
  };
  transaction_count: {
    id: "transactions";
    version: "1.0.0";
    href: "docs/metric-methodology.md#transactions";
  };
  asset_volume: {
    id: "payment-volume";
    version: "1.0.0";
    href: "docs/metric-methodology.md#payment-volume";
  };
  tvl: {
    id: "total-value-locked";
    version: "1.0.0";
    href: "docs/metric-methodology.md#total-value-locked-tvl";
  };
};

export type MetricAggregation = {
  operation_count: {
    kind: "count";
    function: "COUNT(*)";
    granularity: "selected_period";
    dimensions: ["type_string"];
  };
  transaction_count: {
    kind: "count_distinct";
    field: "transaction_hash";
    granularity: "selected_period";
    dimensions: [];
  };
  asset_volume: {
    kind: "sum";
    field: "amount";
    granularity: "selected_period";
    dimensions: ["type_string", "asset_identity"];
  };
  tvl: {
    kind: "snapshot_sum";
    granularity: "point_in_time";
    dimensions: ["protocol", "asset_identity"];
  };
};

export type CoverageConstraint =
  | {
      kind: "time_bounds";
      semantics: "inclusive";
      startField: "start";
      endField: "end";
    }
  | {
      kind: "partial_period";
      completenessField: "isPeriodComplete";
    }
  | {
      kind: "source_lag";
      watermarkField: "sourceTimestamp";
    }
  | {
      kind: "top_n";
      appliesTo:
        | "account_children"
        | "contract_children"
        | "soroban_function_children"
        | "contracts_per_function";
      limit: number;
      partitionBy?: "type_string" | "function_name";
    }
  | {
      kind: "filter";
      field: "asset_type";
      operator: "equals";
      value: "native";
    };

export type MetricProvenance<M extends MetricId> = {
  metric: M;
  methodology: MetricMethodology[M];
  source: {
    provider: "hubble";
    dataset: "crypto-stellar.crypto_stellar_dbt";
    tables: string[];
  };
  aggregation: MetricAggregation[M];
  coverage: {
    network: "stellar_mainnet";
    constraints: CoverageConstraint[];
  };
};

export interface ActivityMetricProvenance {
  operation_count: MetricProvenance<"operation_count">;
  asset_volume: MetricProvenance<"asset_volume">;
}

export const OPERATION_COUNT_UNIT = {
  kind: "count",
  subject: "operation",
} as const satisfies MetricUnit<"operation_count">;

export const XLM_ASSET_UNIT = {
  kind: "asset",
  asset: { type: "native", code: "XLM" },
} as const satisfies MetricUnit<"asset_volume">;

export type TreemapNodeType =
  | "root"
  | "category"
  | "entity"
  | "contract"
  | "account";

export interface EntityInfo {
  name: string;
  category: string;
  protocol: string;
}

export interface CategoryRow {
  type_string: string;
  op_count: number;
  xlm_volume?: number;
}

export interface ContractRow {
  contract_id: string;
  op_count: number;
}

export interface AccountRow {
  account_id: string;
  type_string: string;
  op_count: number;
  xlm_volume?: number;
}

export interface SorobanFunctionRow {
  function_name: string;
  op_count: number;
}

export interface SorobanFunctionContractRow {
  function_name: string;
  contract_id: string;
  op_count: number;
}

export interface ActivityKpis {
  totalOps: {
    kind: "operations";
    unit: "ops";
    value: number;
  };
  sorobanShare: {
    kind: "share";
    unit: "percent";
    value: number;
  };
  topCategory: string;
  activeContracts: {
    kind: "entity_count";
    unit: "count";
    value: number;
  };
}

export interface TreemapNodeMeta {
  type: TreemapNodeType;
  id?: string;
  category?: string;
  protocol?: string;
  share?: number;
  opCount?: number;
  xlmVolume?: number;
  childCount?: number;
  eventType?: string;
}

export interface TreemapNode<TValue extends number | string = number> {
  id?: string;
  name: string;
  value?: TValue;
  color?: string;
  children?: TreemapNode<TValue>[];
  meta?: TreemapNodeMeta;
}

export type TreemapPayload<M extends MetricId> = TreemapNode<MetricValue<M>> & {
  metric: M;
  unit: MetricUnit<M>;
};

export interface ActivityTreemaps {
  events: TreemapPayload<"operation_count">;
  actors: TreemapPayload<"operation_count">;
  xlm_events: TreemapPayload<"asset_volume">;
  xlm_actors: TreemapPayload<"asset_volume">;
}

export interface ActivityResponseMetadata {
  period: Period;
  start: string;
  end: string;
  source: DataSource;
  sourceTimestamp: string;
  isPeriodComplete: boolean;
}

export interface RawResearchRows {
  categories: CategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
}

export interface ActivityVisualizationResponse extends ActivityResponseMetadata {
  kpis: ActivityKpis;
  treemaps: ActivityTreemaps;
  metricProvenance: ActivityMetricProvenance;
}

export interface ActivityRawResearchResponse extends ActivityResponseMetadata {
  rows: RawResearchRows;
}

/** Internal cached dataset from which the two public response surfaces derive. */
export interface ActivityDataset
  extends ActivityResponseMetadata,
    RawResearchRows {
  kpis: ActivityKpis;
  treemaps: ActivityTreemaps;
  metricProvenance: ActivityMetricProvenance;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  supported?: Period[];
}

export interface SelectedNode {
  name: string;
  value: number;
  share: number;
  meta?: TreemapNodeMeta;
}
