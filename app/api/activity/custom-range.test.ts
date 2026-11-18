import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { handleActivityRequest } from "./_handler";
import type { ActivityDataset } from "@/lib/types";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";

function mockActivityDataset(period: string): ActivityDataset {
  return {
    period: period as any,
    start: "2024-01-01T00:00:00.000Z",
    end: "2024-01-07T23:59:59.999Z",
    source: "hubble",
    sourceTimestamp: "2024-01-07T12:00:00.000Z",
    isPeriodComplete: true,
    categories: [],
    transactionCategories: [],
    contracts: [],
    accounts: [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
    usdcPaymentVolume: {
      amount: 0,
      unit: "USDC",
      assetSetId: "stellar-mainnet-usdc-v1",
      methodology: "docs/metric-methodology.md#usdc-payment-volume",
      assets: [],
    },
    usdcCategories: [],
    usdcAccounts: [],
    kpis: {
      totalOps: { kind: "operations", unit: "ops", value: 0 },
      sorobanShare: { kind: "share", unit: "percent", value: 0 },
      topCategory: "none",
      activeContracts: { kind: "entity_count", unit: "count", value: 0 },
      activeWallets: { kind: "entity_count", unit: "count", value: 0 },
      activeDestinationAccounts: { kind: "entity_count", unit: "count", value: 0 },
    },
    treemaps: {
      events: {
        name: "Events",
        value: 0,
        metric: "operation_count",
        unit: { kind: "count", subject: "operation" },
      },
      actors: {
        name: "Actors",
        value: 0,
        metric: "operation_count",
        unit: { kind: "count", subject: "operation" },
      },
      txn_events: {
        name: "Transaction Events",
        value: 0,
        metric: "transaction_count",
        unit: { kind: "count", subject: "transaction" },
      },
      txn_actors: {
        name: "Transaction Actors",
        value: 0,
        metric: "transaction_count",
        unit: { kind: "count", subject: "transaction" },
      },
      xlm_events: {
        name: "XLM Events",
        metric: "asset_volume",
        value: "0",
        unit: {
          kind: "asset",
          asset: { type: "native", code: "XLM" },
        },
      },
      xlm_actors: {
        name: "XLM Actors",
        metric: "asset_volume",
        value: "0",
        unit: {
          kind: "asset",
          asset: { type: "native", code: "XLM" },
        },
      },
      usdc_events: {
        name: "USDC Events",
        metric: "asset_volume",
        value: "0",
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
        name: "USDC Actors",
        metric: "asset_volume",
        value: "0",
        unit: {
          kind: "asset",
          asset: {
            type: "issued",
            code: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        },
      },
      protocol_tvl: {
        name: "Protocol TVL",
        metric: "tvl",
        value: "0",
        unit: {
          kind: "asset",
          asset: { type: "issued", code: "USD", issuer: "adapter" },
        },
        children: [],
      },
    },
    metricProvenance: buildActivityMetricProvenance(),
  };
}

describe("Custom date range validation (issue #444)", () => {
  test("accepts valid custom date range", async () => {
    // Enable fixture mode for this test
    const previousSource = process.env.LUMENMAP_DATA_SOURCE;
    process.env.LUMENMAP_DATA_SOURCE = "fixture";
    
    try {
      const calls: string[] = [];
      const response = await handleActivityRequest(
        new Request("http://localhost/api/v1/activity?period=custom:2024-01-01:2024-01-07"),
        async (period) => {
          calls.push(period);
          return mockActivityDataset(period);
        },
      );

      assert.equal(response.status, 200);
      assert.deepEqual(calls, ["custom:2024-01-01:2024-01-07"]);
      const body = await response.json();
      assert.equal(body.period, "custom:2024-01-01:2024-01-07");
    } finally {
      if (previousSource === undefined) {
        delete process.env.LUMENMAP_DATA_SOURCE;
      } else {
        process.env.LUMENMAP_DATA_SOURCE = previousSource;
      }
    }
  });

  test("rejects inverted custom date range", async () => {
    let callCount = 0;
    const response = await handleActivityRequest(
      new Request("http://localhost/api/v1/activity?period=custom:2024-01-31:2024-01-01"),
      async (period) => {
        callCount += 1;
        return mockActivityDataset(period);
      },
    );

    assert.equal(response.status, 400);
    assert.equal(callCount, 0, "Should not invoke provider for invalid range");
    const body = await response.json();
    assert.equal(body.code, "INVALID_PERIOD");
    assert.ok(body.message.includes("before or equal"), "Error message should mention date order");
  });

  test("rejects custom range exceeding 90 days", async () => {
    let callCount = 0;
    const response = await handleActivityRequest(
      new Request("http://localhost/api/v1/activity?period=custom:2024-01-01:2024-05-01"),
      async (period) => {
        callCount += 1;
        return mockActivityDataset(period);
      },
    );

    assert.equal(response.status, 400);
    assert.equal(callCount, 0, "Should not invoke provider for range exceeding max");
    const body = await response.json();
    assert.equal(body.code, "INVALID_PERIOD");
    assert.ok(body.message.includes("90"), "Error message should mention max days");
  });

  test("rejects malformed custom period format", async () => {
    let callCount = 0;
    const response = await handleActivityRequest(
      new Request("http://localhost/api/v1/activity?period=custom:2024-01-01"),
      async (period) => {
        callCount += 1;
        return mockActivityDataset(period);
      },
    );

    assert.equal(response.status, 400);
    assert.equal(callCount, 0);
    const body = await response.json();
    assert.equal(body.code, "INVALID_PERIOD");
  });

  test("rejects invalid dates in custom period", async () => {
    let callCount = 0;
    const response = await handleActivityRequest(
      new Request("http://localhost/api/v1/activity?period=custom:2024-13-01:2024-01-31"),
      async (period) => {
        callCount += 1;
        return mockActivityDataset(period);
      },
    );

    assert.equal(response.status, 400);
    assert.equal(callCount, 0);
    const body = await response.json();
    assert.equal(body.code, "INVALID_PERIOD");
  });

  test("accepts custom range at max boundary (90 days)", async () => {
    const previousSource = process.env.LUMENMAP_DATA_SOURCE;
    process.env.LUMENMAP_DATA_SOURCE = "fixture";
    
    try {
      const response = await handleActivityRequest(
        new Request("http://localhost/api/v1/activity?period=custom:2024-01-01:2024-03-31"),
        async (period) => mockActivityDataset(period),
      );

      assert.equal(response.status, 200);
    } finally {
      if (previousSource === undefined) {
        delete process.env.LUMENMAP_DATA_SOURCE;
      } else {
        process.env.LUMENMAP_DATA_SOURCE = previousSource;
      }
    }
  });

  test("accepts single day custom range", async () => {
    const previousSource = process.env.LUMENMAP_DATA_SOURCE;
    process.env.LUMENMAP_DATA_SOURCE = "fixture";
    
    try {
      const response = await handleActivityRequest(
        new Request("http://localhost/api/v1/activity?period=custom:2024-01-15:2024-01-15"),
        async (period) => mockActivityDataset(period),
      );

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.period, "custom:2024-01-15:2024-01-15");
    } finally {
      if (previousSource === undefined) {
        delete process.env.LUMENMAP_DATA_SOURCE;
      } else {
        process.env.LUMENMAP_DATA_SOURCE = previousSource;
      }
    }
  });

  test("custom range validation error does not cache", async () => {
    const response = await handleActivityRequest(
      new Request("http://localhost/api/v1/activity?period=custom:2024-01-31:2024-01-01"),
      async (period) => mockActivityDataset(period),
    );

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});
