import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GET as legacyGET } from "./route";
import {
  GET as sharedGET,
  handleActivityRequest,
  handleRawActivityRequest,
  parseActivityPeriod,
  toVisualizationResponse,
} from "./_handler";
import { GET as v1GET } from "../v1/activity/route";
import { GET as rawV1GET } from "../v1/activity/raw/route";
import type {
  ActivityDataset,
  ActivityRawResearchResponse,
  ActivityVisualizationResponse,
  Period,
} from "@/lib/types";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";

const supportedPeriods: Period[] = ["1d", "7d", "30d", "month"];

function mockActivityDataset(period: Period): ActivityDataset {
  return {
    period,
    start: "2026-08-03T00:00:00.000Z",
    end: "2026-08-03T23:59:59.999Z",
    source: "hubble",
    sourceTimestamp: "2026-08-03T12:00:00.000Z",
    isPeriodComplete: false,
    categories: [],
    contracts: [],
    accounts: [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
    kpis: {
      totalOps: { kind: "operations", unit: "ops", value: 0 },
      sorobanShare: { kind: "share", unit: "percent", value: 0 },
      topCategory: "none",
      activeContracts: { kind: "entity_count", unit: "count", value: 0 },
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
    },
    metricProvenance: buildActivityMetricProvenance(),
  };
}

function representativeActivityDataset(): ActivityDataset {
  return {
    ...mockActivityDataset("1d"),
    categories: Array.from({ length: 40 }, (_, index) => ({
      type_string: `operation_type_${index}`,
      op_count: 10_000 - index,
      xlm_volume: 1_000 - index,
    })),
    contracts: Array.from({ length: 80 }, (_, index) => ({
      contract_id: `C${index.toString().padStart(55, "0")}`,
      op_count: 5_000 - index,
    })),
    accounts: Array.from({ length: 250 }, (_, index) => ({
      account_id: `G${index.toString().padStart(55, "0")}`,
      type_string: `operation_type_${index % 10}`,
      op_count: 2_000 - index,
      xlm_volume: 500 - index,
    })),
    sorobanFunctions: Array.from({ length: 80 }, (_, index) => ({
      function_name: `function_${index}`,
      op_count: 1_000 - index,
    })),
    sorobanFunctionContracts: Array.from({ length: 250 }, (_, index) => ({
      function_name: `function_${index % 20}`,
      contract_id: `C${index.toString().padStart(55, "0")}`,
      op_count: 750 - index,
    })),
  };
}

describe("parseActivityPeriod", () => {
  test("defaults to 1d only when the period parameter is absent", () => {
    assert.deepEqual(parseActivityPeriod(null), { ok: true, period: "1d" });
  });

  test("accepts documented periods", () => {
    for (const period of supportedPeriods) {
      assert.deepEqual(parseActivityPeriod(period), { ok: true, period });
    }
  });

  test("rejects empty and unsupported explicit periods", () => {
    for (const period of ["", "1y"]) {
      assert.deepEqual(parseActivityPeriod(period), {
        ok: false,
        status: 400,
        body: {
          code: "INVALID_PERIOD",
          message: "Unsupported activity period.",
          supported: supportedPeriods,
        },
      });
    }
  });
});

describe("GET /api/activity and /api/v1/activity", () => {
  test("legacy and v1 routes share the same handler", () => {
    assert.equal(legacyGET, sharedGET);
    assert.equal(v1GET, sharedGET);
  });

  test("returns 200 and defaults to 1d when period is missing", async () => {
    const calls: Period[] = [];
    const response = await handleActivityRequest(
      new Request("http://localhost/api/activity"),
      async (period) => {
        calls.push(period);
        return mockActivityDataset(period);
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ["1d"]);
    const body = (await response.json()) as ActivityVisualizationResponse;
    assert.equal(body.period, "1d");
    assert.equal(
      body.metricProvenance[body.treemaps.events.metric].methodology.id,
      "operations",
    );
  });

  test("returns 200 for each supported period", async () => {
    const calls: Period[] = [];

    for (const period of supportedPeriods) {
      const response = await handleActivityRequest(
        new Request(`http://localhost/api/activity?period=${period}`),
        async (requestedPeriod) => {
          calls.push(requestedPeriod);
          return mockActivityDataset(requestedPeriod);
        },
      );

      assert.equal(response.status, 200);
      assert.equal((await response.json()).period, period);
    }

    assert.deepEqual(calls, supportedPeriods);
  });

  test("returns 400 for invalid explicit periods without invoking the provider", async () => {
    for (const period of ["", "1y"]) {
      let callCount = 0;
      const response = await handleActivityRequest(
        new Request(`http://localhost/api/activity?period=${period}`),
        async () => {
          callCount += 1;
          return mockActivityDataset("1d");
        },
      );

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        code: "INVALID_PERIOD",
        message: "Unsupported activity period.",
        supported: supportedPeriods,
      });
      assert.equal(callCount, 0);
    }
  });

  test("returns identical successful responses for legacy and v1 paths", async () => {
    const fetchActivityData = async (period: Period) =>
      mockActivityDataset(period);
    const injectedLegacy = await handleActivityRequest(
      new Request("http://localhost/api/activity?period=7d"),
      fetchActivityData,
    );
    const injectedV1 = await handleActivityRequest(
      new Request("http://localhost/api/v1/activity?period=7d"),
      fetchActivityData,
    );

    assert.equal(legacyGET, v1GET);
    assert.equal(injectedLegacy.status, 200);
    assert.equal(injectedV1.status, 200);
    assert.deepEqual(await injectedLegacy.json(), await injectedV1.json());
  });

  test("omits raw research collections from the compact response", async () => {
    const response = await handleActivityRequest(
      new Request("http://localhost/api/v1/activity?period=1d"),
      async () => representativeActivityDataset(),
    );
    const body = (await response.json()) as Record<string, unknown>;

    for (const key of [
      "categories",
      "contracts",
      "accounts",
      "sorobanFunctions",
      "sorobanFunctionContracts",
      "rows",
    ]) {
      assert.equal(key in body, false, `${key} must not be in the compact response`);
    }
    assert.ok("kpis" in body);
    assert.ok("treemaps" in body);
    assert.ok("metricProvenance" in body);
  });

  test("keeps the representative compact payload below 40% of the combined fixture", () => {
    const fixture = representativeActivityDataset();
    const combinedBytes = Buffer.byteLength(JSON.stringify(fixture));
    const compactBytes = Buffer.byteLength(
      JSON.stringify(toVisualizationResponse(fixture)),
    );

    assert.ok(
      compactBytes < combinedBytes * 0.4,
      `expected compact payload (${compactBytes} bytes) to be below 40% of combined fixture (${combinedBytes} bytes)`,
    );
  });

  test("returns a safe provider error response", async () => {
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const response = await handleActivityRequest(
        new Request("http://localhost/api/v1/activity?period=30d"),
        async () => {
          throw new Error("BigQuery query failed with backend detail");
        },
      );

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("returns a safe schema validation error response", async () => {
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const invalidDataset = mockActivityDataset("1d");
      invalidDataset.sourceTimestamp = "not-a-timestamp";

      const response = await handleActivityRequest(
        new Request("http://localhost/api/v1/activity?period=1d"),
        async () => invalidDataset,
      );

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        error: "Activity response failed validation",
      });
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe("GET /api/v1/activity/raw", () => {
  test("exports the explicit raw research route", () => {
    assert.equal(typeof rawV1GET, "function");
  });

  test("returns raw rows without visualization payloads", async () => {
    const fixture = representativeActivityDataset();
    const response = await handleRawActivityRequest(
      new Request("http://localhost/api/v1/activity/raw?period=1d"),
      async () => fixture,
    );
    const body = (await response.json()) as ActivityRawResearchResponse &
      Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(body.rows.categories, fixture.categories);
    assert.deepEqual(body.rows.contracts, fixture.contracts);
    assert.deepEqual(body.rows.accounts, fixture.accounts);
    assert.deepEqual(body.rows.sorobanFunctions, fixture.sorobanFunctions);
    assert.deepEqual(
      body.rows.sorobanFunctionContracts,
      fixture.sorobanFunctionContracts,
    );
    assert.equal("kpis" in body, false);
    assert.equal("treemaps" in body, false);
    assert.equal("metricProvenance" in body, false);
  });
});
