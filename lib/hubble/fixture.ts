/**
 * Illustrative fixture dataset for opt-in local/e2e mode (LuMENMAP DATA_SOURCE=fixture).
 * Values do not reflect real network state and must never be selected silently in production.
 */

import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type {
  ActivityDataset,
  Period,
  HeatmapBucket,
  FlowNode,
  FlowEdge,
  FlowGraphResponse,
  RawFlowEdgeRow,
} from "@/lib/types";

export function buildFixtureDataset(period: Period = "1d"): ActivityDataset {
  const heatmapBuckets: HeatmapBucket[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      let op_count = (d + 1) * 500 + h * 75;
      let tx_count = Math.floor(op_count * 0.8);
      // Spike on weekdays at 14:00 UTC
      if (d > 0 && d < 6 && h === 14) {
        op_count += 15000;
        tx_count += 12000;
      }
      heatmapBuckets.push({
        dayOfWeek: d,
        hourOfDay: h,
        operations: op_count,
        transactions: tx_count,
      });
    }
  }

  return {
    period,
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-01-01T23:59:59.999Z",
    source: "fixture",
    sourceTimestamp: "2026-01-02T00:00:00.000Z",
    isPeriodComplete: true,
    categories: [
      {
        type_string: "invoke_host_function",
        op_count: 420000,
        xlm_volume: 12000,
      },
      { type_string: "payment", op_count: 180000, xlm_volume: 84000 },
      { type_string: "manage_sell_offer", op_count: 95000, xlm_volume: 22000 },
      {
        type_string: "path_payment_strict_receive",
        op_count: 62000,
        xlm_volume: 15000,
      },
      { type_string: "change_trust", op_count: 31000, xlm_volume: 0 },
    ],
    transactionCategories: [
      { type_string: "payment", txn_count: 120000 },
      { type_string: "invoke_host_function", txn_count: 85000 },
      { type_string: "manage_sell_offer", txn_count: 40000 },
      { type_string: "path_payment_strict_receive", txn_count: 25000 },
      { type_string: "change_trust", txn_count: 15000 },
    ],
    contracts: [
      {
        contract_id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
        op_count: 88000,
      },
      {
        contract_id: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
        op_count: 54000,
      },
    ],
    accounts: [
      {
        account_id: "GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
        type_string: "payment",
        op_count: 42000,
        xlm_volume: 12000,
      },
      {
        account_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
        type_string: "payment",
        op_count: 18000,
        xlm_volume: 4500,
      },
    ],
    sorobanFunctions: [
      { function_name: "swap", op_count: 95000 },
      { function_name: "deposit", op_count: 62000 },
      { function_name: "withdraw", op_count: 41000 },
    ],
    sorobanFunctionContracts: [
      {
        function_name: "swap",
        contract_id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
        op_count: 55000,
      },
      {
        function_name: "deposit",
        contract_id: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
        op_count: 38000,
      },
    ],
    usdcPaymentVolume: {
      amount: 125000.5,
      unit: "USDC",
      assetSetId: "stellar-mainnet-usdc-v1",
      methodology: "docs/metric-methodology.md#usdc-payment-volume",
      assets: [],
    },
    assetVolumes: [
      {
        asset: { type: "native", code: "XLM" },
        amount: "16500",
        opCount: 60000,
      },
      {
        asset: {
          type: "issued",
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        amount: "125000.5",
        opCount: 42000,
      },
      {
        asset: {
          type: "issued",
          code: "USDC",
          issuer: "GAAZI4TCRCTY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
        },
        amount: "9200",
        opCount: 3100,
      },
    ],
    usdcCategories: [
      { type_string: "payment", amount: 100000.5 },
      { type_string: "path_payment_strict_receive", amount: 25000 },
    ],
    usdcAccounts: [
      {
        account_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
        type_string: "payment",
        amount: 80000,
      },
    ],
    kpis: {
      totalOps: { kind: "operations", unit: "ops", value: 860000 },
      sorobanShare: { kind: "share", unit: "percent", value: 51 },
      topCategory: "soroban",
      activeContracts: { kind: "entity_count", unit: "count", value: 2 },
      activeWallets: { kind: "entity_count", unit: "count", value: 1500 },
      activeDestinationAccounts: {
        kind: "entity_count",
        unit: "count",
        value: 1200,
      },
    },
    treemaps: {
      events: {
        name: "Network Activity",
        metric: "operation_count",
        unit: { kind: "count", subject: "operation" },
        value: 860000,
        meta: { type: "root", opCount: 860000 },
        children: [
          {
            name: "Soroban Contracts",
            value: 434000,
            meta: {
              type: "category",
              category: "soroban",
              opCount: 434000,
              share: 50.5,
              childCount: 1,
            },
            children: [
              {
                name: "swap",
                value: 95000,
                meta: {
                  type: "entity",
                  category: "soroban",
                  opCount: 95000,
                  eventType: "swap",
                },
              },
            ],
          },
          {
            name: "Payments",
            value: 180000,
            meta: {
              type: "category",
              category: "payments",
              opCount: 180000,
              share: 20.9,
              childCount: 1,
            },
            children: [
              {
                name: "payment",
                value: 180000,
                meta: {
                  type: "entity",
                  category: "payments",
                  opCount: 180000,
                  eventType: "payment",
                },
              },
            ],
          },
        ],
      },
      actors: {
        name: "Network Activity",
        metric: "operation_count",
        unit: { kind: "count", subject: "operation" },
        value: 60000,
        meta: { type: "root", opCount: 60000 },
        children: [
          {
            name: "Payments",
            value: 60000,
            meta: {
              type: "category",
              category: "payments",
              opCount: 60000,
              share: 100,
              childCount: 1,
            },
            children: [
              {
                name: "GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
                value: 42000,
                meta: {
                  type: "entity",
                  category: "payments",
                  opCount: 42000,
                  id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
                },
              },
            ],
          },
        ],
      },
      txn_events: {
        name: "Network Activity",
        metric: "transaction_count",
        unit: { kind: "count", subject: "transaction" },
        value: 285000,
        meta: { type: "root", txnCount: 285000 },
        children: [
          {
            name: "Payments",
            value: 120000,
            meta: {
              type: "category",
              category: "payments",
              txnCount: 120000,
              share: 42.1,
              childCount: 1,
            },
            children: [
              {
                name: "payment",
                value: 120000,
                meta: {
                  type: "entity",
                  category: "payments",
                  txnCount: 120000,
                  eventType: "payment",
                },
              },
            ],
          },
          {
            name: "Soroban Contracts",
            value: 85000,
            meta: {
              type: "category",
              category: "soroban",
              txnCount: 85000,
              share: 29.8,
              childCount: 1,
            },
            children: [
              {
                name: "invoke host function",
                value: 85000,
                meta: {
                  type: "entity",
                  category: "soroban",
                  txnCount: 85000,
                  eventType: "invoke_host_function",
                },
              },
            ],
          },
        ],
      },
      txn_actors: {
        name: "Network Activity",
        metric: "transaction_count",
        unit: { kind: "count", subject: "transaction" },
        value: 0,
        meta: { type: "root", txnCount: 0 },
        children: [],
      },
      xlm_events: {
        name: "XLM Events",
        metric: "asset_volume",
        value: "133000",
        unit: { kind: "asset", asset: { type: "native", code: "XLM" } },
      },
      xlm_actors: {
        name: "XLM Actors",
        metric: "asset_volume",
        value: "16500",
        unit: { kind: "asset", asset: { type: "native", code: "XLM" } },
      },
      usdc_events: {
        name: "Network USDC Activity",
        metric: "asset_volume",
        value: "125000.5",
        unit: {
          kind: "asset",
          asset: {
            type: "issued",
            code: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        },
      },
      usdc_actors: {
        name: "Network USDC Activity",
        metric: "asset_volume",
        value: "125000.5",
        unit: {
          kind: "asset",
          asset: {
            type: "issued",
            code: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        },
      },
      protocol_tvl: {
        name: "Protocol TVL",
        metric: "tvl",
        value: "740000000",
        unit: {
          kind: "asset",
          asset: { type: "issued", code: "USD", issuer: "adapter" },
        },
        meta: { type: "root", tvlUsd: 740000000, childCount: 0 },
        children: [],
      },
    },
    metricProvenance: buildActivityMetricProvenance(),
    heatmap: {
      buckets: heatmapBuckets,
    },
  };
}

/** @deprecated Prefer buildFixtureDataset(period); kept for CONTRIBUTING references. */
export const fixtureResponse = buildFixtureDataset("1d");

// -----------------------------------------------------------------------------
// Flow graph fixture dataset
// -----------------------------------------------------------------------------

export const FLOW_FIXTURE_ASSET_KEYS: ReadonlyArray<string> = [
  "native:XLM",
  "issued:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
];

/**
 * Raw edge rows as they would arrive from BigQuery (denormalized, one row per transfer).
 * These are deliberately not deduped and include parallel edges between the same pair.
 */
export const FLOW_FIXRURE_RAW_EDGES = [
  {
    from: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
    to: "GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
    assetKey: "native:XLM",
    opCount: 12000,
    xlmVolume: "12000",
  },
  {
    from: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
    to: "GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
    assetKey: "native:XLM",
    opCount: 8000,
    xlmVolume: "8000",
  },
  {
    from: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    to: "CA4HEQTL2WPEUYYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    assetKey: "issued:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPR5RE34K4KZVN",
    opCount: 42000,
    xlmVolume: "0",
  },
  {
    from: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
    to: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
    assetKey: "issued:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPR5RE34K4KZVN",
    opCount: 18000,
    xlmVolume: "0",
  },
  {
    from: "GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
    to: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
    assetKey: "issued:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPR5RE34K4KZVN",
    opCount: 62000,
    xlmVolume: "0",
  },
  {
    from: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
    to: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    assetKey: "native:XLM",
    opCount: 95000,
    xlmVolume: "95000",
  },
  {
    from: "GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
    to: "GAAZI4TCRCTY5OJHCTJC2A4QSY6CJWJJ5IAJTGKIN2EX7LBNKNLXLTCV",
    assetKey: "native:XLM",
    opCount: 4500,
    xlmVolume: "4500",
  },
  {
    from: "CA4HEQTL2WPEUYYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    to: "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
    assetKey: "issued:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RhTM335X2KGX3IHOJAPP5RE34K4KZVN",
    opCount: 3100,
    xlmVolume: "0",
  },
] as const satisfies ReadonlyArray<RawFlowEdgeRow>;

/**
 * Build a typed FlowGraphResponse from raw edge rows.
 *
 * Rules (matching the Flow ADR):
 * - Nodes are deduped by id (account ID or contract ID).
 * - Parallel edges between the same (from, to, assetKey) triple are aggregated
 *    by summing opCount and xlmVolume.
 * - Node labels default to the node id and are overridable via the optional
 *    labels map.
 */
export function buildFlowGraph(
  rows: ReadonlyArray<RawFlowEdgeRow>,
  options: {
    labels?: ReadonlyMap<string, string> | { get(key: string): string | undefined };
  } = {},
}: FlowGraphResponse {
  const nodes = new Map<string, FlowNode>();
  const edges = new Map<string, FlowEdge>();

  const labelFor = (id: string): string => {
    const explicit = options.labels?.get(id);
    return explicit ?? id;
  };

  const ensureNode = (id: string): void => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: labelFor(id), metrics: {} });
    }
  };

  for (const row of rows) {
    ensureNode(row.from);
    ensureNode(row.to);

    const key = `${row.from}\u0000${row.to}\u0000${row.assetKey}`;
    const existing = edges.get(key);
    if (existing) {
      existing.metrics.opCount += row.opCount;
      existing.metrics.xlmVolume = (
        Number(existing.metrics.xlmVolume ?? "0") + Number(row.xlmVolume ?? "0")
      ).toString();
    } else {
      edges.set(key, {
        id: key,
        from: row.from,
        to: row.to,
        assetKey: row.assetKey,
        metrics: {
          opCount: row.opCount,
          xlmVolume: row.xlmVolume,
        },
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}

export function buildFixtureFlowGraph(): FlowGraphResponse {
  return buildFlowGraph(FLOW_FIXTURE_RAW_EDGES);
}
