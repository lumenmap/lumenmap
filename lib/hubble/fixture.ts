/**
 * Illustrative fixture dataset for opt-in local/e2e mode (LUMENMAP_DATA_SOURCE=fixture).
 * Values do not reflect real network state and must never be selected silently in production.
 */

import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type { ActivityDataset, Period } from "@/lib/types";

export function buildFixtureDataset(period: Period = "1d"): ActivityDataset {
  return {
    period,
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-01-01T23:59:59.999Z",
    source: "fixture",
    sourceTimestamp: "2026-01-02T00:00:00.000Z",
    isPeriodComplete: true,
    categories: [
      { type_string: "invoke_host_function", op_count: 420000, xlm_volume: 12000 },
      { type_string: "payment", op_count: 180000, xlm_volume: 84000 },
      { type_string: "manage_sell_offer", op_count: 95000, xlm_volume: 22000 },
      { type_string: "path_payment_strict_receive", op_count: 62000, xlm_volume: 15000 },
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
        account_id: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        type_string: "payment",
        op_count: 42000,
        xlm_volume: 12000,
      },
      {
        account_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNKNLXLTCV",
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
    usdcCategories: [
      { type_string: "payment", amount: 100000.5 },
      { type_string: "path_payment_strict_receive", amount: 25000 },
    ],
    usdcAccounts: [
      {
        account_id: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        type_string: "payment",
        amount: 80000,
      },
    ],
    kpis: {
      totalOps: { kind: "operations", unit: "ops", value: 860000 },
      sorobanShare: { kind: "share", unit: "percent", value: 51 },
      topCategory: "soroban",
      activeContracts: { kind: "entity_count", unit: "count", value: 2 },
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
                name: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
                value: 42000,
                meta: {
                  type: "entity",
                  category: "payments",
                  opCount: 42000,
                  id: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
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
      ],
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
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        },
      },
    },
    metricProvenance: buildActivityMetricProvenance(),
  };
}

/** @deprecated Prefer buildFixtureDataset(period); kept for CONTRIBUTING references. */
export const fixtureResponse = buildFixtureDataset("1d");
