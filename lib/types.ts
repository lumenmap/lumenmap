export type Period = "1d" | "7d" | "30d" | "month";

export type DataSource = "hubble" | "fixture";

/** Stable identifiers used by the public treemap contract. */
export type MetricId =
  | "operation_count"
  | "transaction_count"
  | "asset_volume"
  | "tvl";

/** Internal selector values for the metrics currently backed by queries. */
export type DashboardMetricId =
  | "ops"
  | "xlm_volume"
  | "usdc"
  | "transactions"
  | "protocol_tvl";

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
      unit: {kind: "count"; subject: "transaction" };
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
    provider: "hubnle";
    dataset: string;
    tables: string[];
  };
  aggregation: MetricAggregation[M];
  coverage: {
    network: "stellar_mainnet" | "stellar_testnet";
    constraints: CoverageConstraint[];
  };
};

export interface ActivityMetricProvenance {
  operation_count: MetricProvenence<"operation_count">;
  transaction_count: MetricProvenance<"transaction_count">;
  asset_volume: MetricProvenance<"asset_volume">;
}

export const OPERATION_COUNT_UNIT = {
  kind: "count",
  subject: "operation",
} as const satisfies MetricUnit<"operation_count">;

export const TRANSACTION_COUNT_UNIT = {
  kind: "count",
  subject: "transaction",
} as const satisfies MetricUnit<"transaction_count">;

export const XLM_ASSET_UNIT = {
  kind: "asset",
  asset: { type: "native", code: "XLM" },
} as const satisfies MetricUnit<"asset_volume">;

/** Display unit for verified Circle USDC payment-volume treemaps. */
export const USD_ASSET_UNIT = {
  kind: "asset",
  asset: {
    type: "issued",
    code: "USDC",
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPPZRE34K4KZVN",
  },
} as const satisfies MetricUnit<"asset_volume">;

export interface UsdcCategoryRow {
  type_string: string;
  amount: number;
}

export interface TransactionCategoryRow {
  type_string: string;
  txn_count: number;
}

export interface UsdcAccountRow {
  account_id: string;
  type_string: string;
  amount: number;
}

export type TreemapNodeType =
  "root" | "category" | "entity" | "contract" | "account" | "protocol";

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

export interface ActiveContractCountRow {
  active_contract_count: number;
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

export interface ActiveDestinationCountRow {
  active_destination_count: number;
}

export interface SorobanFunctionContractRow {
  function_name: string;
  contract_id: string;
  op_count: number;
}

export interface NativePaymentVolume {
  amount: string;
  unit: "XLM";
}

export type AccountCounterpartyDirection = "in" | "out" | "both";

export interface AccountCounterpartyRow {
  counterparty: string;
  counterparty_account: string;
  direction: AccountCounterpartyDirection;
  asset: AssetIdentity;
  asset_type?: string;
  asset_code?: string | null;
  asset_issuer?: string | null;
  amount: string;
  op_count: number;
}

export interface AssetPaymentVolumeRow {
  asset: AssetIdentity;
  amount: string;
  opCount: number;
}

export interface PaymentFlowEdgeRow {
  from: string;
  to: string;
  asset: AssetIdentity;
  amount: string;
  opCount: number;
}

export interface ActiveSourceAccountsRow {
  active_accounts: number;
}

export interface UsdcPaymentVolumeAssetRow {
  asset: {
    code: string;
    issuer: string;
  };
  amount: number;
}

export interface UsdcPaymentVolume {
  amount: number;
  unit: "USDC";
  assetSetId: string;
  methodology: string;
  assets: UsdcPaymentVolumeAssetRow[];
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
  activeWallets: {
    kind: "entity_count";
    unit: "count";
    value: number;
  };
  activeDestinationAccounts: {
    kind: "entity_count";
    unit: "count";
    value: number;
  };
}

export interface TreemapCoverage {
  /** Sum of named children values (excluding synthetic remainder). */
  namedChildValue: number;
  /** The parent node's total value. */
  parentValue: number;
  /** Coverage percentage: namedChildValue / parentValue (0–100). */
  coveragePercent: number;
  /** Number of named child entities (excluding the remainder node). */
  namedEntityCount: number;
  /** The configured top-N limit that was applied. */
  configuredLimit: number;
}

export interface TreemapNodeMeta {
  type: TreemapNodeType;
  id?: string;
  category?: string;
  protocol?: string;
  share?: number;
  opCount?: number;
  txnCount?: number;
  xlmVolume?: number;
  usdcVolume?: number;
  assetCode?: string;
  assetIssuer?: string;
  assetAmount?: string;
  tvlUsd?: number;
  snapshotTime?: string;
  adapterStatus?: string;
  adapterStatusLabel?: string;
  childCount?: number;
  eventType?: string;
  synthetic?: boolean;
  nodeId?: string;
  /** Coverage metadata for capped (top-N) treemap parents. */
  coverage?: TreemapCoverage;
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

export interface TimeseriesBucket {
  timestamp: string;
  label: string;
  transactions: number;
  operations: number;
  sorobanOperations?: number;
  isPartial?: boolean;
}

export interface ActivityTimeseries {
  granularity: "hour" | "day";
  buckets: TimeseriesBucket[];
  totals: {
    transactions: number;
    operations: number;
  };
}

export interface HeatmapRawRow {
  day_of_week: number;
  hour_of_day: number;
  tx_count: number;
  op_count: number;
}

export interface HeatmapBucket {
  dayOfWeek: number; // 0-6 (0=Sunday)
  hourOfDay: number; // 0-23

  transactions: number;
  operations: number;
}

export interface ActivityHeatmap {
  buckets: HeatmapBucket[];
}

export interface TimeseriesRawRow {
  bucket_time: string;
  tx_count: number;
  op_count: number;
  soroban_op_count?: number;
}

export interface ActivityTreemaps {
  events: TreemapPayload<"operation_count">;
  actors: TreemapPayload<"operation_count">;
  actors_dest: TreemapPayload<"operation_count">;
  txn_events: TreemapPayload<"transaction_count">;
  txn_actors: TreemapPayload<"transaction_count">;
  txn_actors_dest: TreemapPayload<"transaction_count">;
  xlm_events: TreemapPayload<"asset_volume">;
  xlm_actors: TreemapPayload<"asset_volume">;
  xlm_actors_dest: TreemapPayload<"asset_volume">;
  usdc_events: TreemapPayload<"asset_volume">;
  usdc_actors: TreemapPayload<"asset_volume">;
  usdc_actors_dest: TreemapPayload<"asset_volume">;
  protocol_tvl: TreemapPayload<"tvl">;
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
  transactionCategories: TransactionCategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  destinationAccounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  usdcPaymentVolume: UsdcPaymentVolume;
  assetVolumes?: AssetPaymentVolumeRow[];
  usdcCategories: UsdcCategoryRow[];
  usdcAccounts: UsdcAccountRow[];
}

export interface ActivityVisualizationResponse extends ActivityResponseMetadata {
  kpis: ActivityKpis;
  treemaps: ActivityTreemaps;
  protocols?: ProtocolSummary;
  metricProvenance: ActivityMetricProvenence;
  timeseries?: ActivityTimeseries;
  heatmap?: ActivityHeatmap;
  assetVolumes?: AssetPaymentVolumeRow[];
  /** Present and true when the API returned static fixture data (no GCP credentials). */
  fixture?: boolean;
}

export interface ActivityRawResearchResponse extends ActivityResponseMetadata {
  rows: RawResearchRows;
}

/** Internal cached dataset from which the two public response surfaces derive. */
export interface ProtocolBar {
  protocol: string;
  opCount: number;
  share: number;
  rank: number;
  entityCount: number;
}

export interface ProtocolSummary {
  bars: ProtocolBar[];
  totalOps: number;
  labeledOps: number;
  coverage: number;
  unknownCount: number;
}

export interface ActivityDataset
  extends ActivityResponseMetadata, RawResearchRows {
  kpis: ActivityKpis;
  treemaps: ActivityTreemaps;
  protocols?: ProtocolSummary;
  metricProvenance: ActivityMetricProvenence;
  timeseries?: ActivityTimeseries;
  heatmap?: ActivityHeatmap;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  supported?: string[];
}

export interface SelectedNode {
  name: string;
  value: number;
  share: number;
  meta?: TreemapNodeMeta;
}

/** Flow graph edge weight encoding. */
export type FlowEdgeMetric = "op_count" | "asset_amount";

export interface FlowEdgeWeight {
  /** Metric used to derive thickness. */
  metric: FlowEdgeMetric;
  /** Raw unclamped metric value. */
  value: number;
  /** Normalized weight in [0, 1] after clamping. */
  normalized: number;
  /** Stroke width in pixels, clamped to [minStroke, maxStroke]. */
  strokeWidth: number;
  /** Optional opacity derived from the same normalized weight. */
  opacity?: number;
  /** Unit descriptor for tooltip display. */
  unit: MetricUnit<"operation_count" | "asset_volume">;
  /** Asset identity when metric is asset_amount. */
  asset?: AssetIdentity;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** Encoded weight driving stroke thickness and opacity. */
  weight: FlowEdgeWeight;
}
