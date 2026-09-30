import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  handleTimeseriesRequest,
  parseTimeseriesGranularity,
  parseTimeseriesPeriod,
} from "./_handler";
import { handleFlowRequest, parseFlowQuery } from "./_flow-handler";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";
import type { Period } from "@/lib/types";
import type { TimeseriesResponse } from "@/lib/hubble/timeseries-data";
import type { FlowGraph } from "@/lib/types/flow-graph";

const supportedPeriods: Period[] = ["1d", "7d", "30d", "month"];

function mockTimeseriesResponse(period: Period): TimeseriesResponse {
  return {
    period,
    start: "2026-08-03T00:00:00.000Z",
    end: "2026-08-03T23:59:59.999Z",
    source: "hubble",
    sourceTimestamp: "2026-08-03T12:00:00.000Z",
    isPeriodComplete: false,
    granularity: period === "1d" ? "hour" : "day",
    buckets: [
      {
        timestamp: "2026-08-03T00:00:00.000Z",
        label: period === "1d" ? "00:00 UTC" : "Aug 3",
        transactions: 100,
        operations: 350,
      },
    ],
    totals: {
      transactions: 100,
      operations: 350,
    },
    metricProvenance: buildActivityMetricProvenance(),
  };
}

describe("parseTimeseriesPeriod", () => {
  test("defaults to 1d when absent", () => {
    assert.deepEqual(parseTimeseriesPeriod(null), { ok: true, period: "1d" });
  });

  test("rejects invalid periods", () => {
    assert.equal(parseTimeseriesPeriod("1y").ok, false);
  });
});

describe("parseTimeseriesGranularity", () => {
  test("accepts hour and day", () => {
    assert.deepEqual(parseTimeseriesGranularity("hour"), {
      ok: true,
      granularity: "hour",
    });
    assert.deepEqual(parseTimeseriesGranularity("day"), {
      ok: true,
      granularity: "day",
    });
  });

  test("rejects invalid granularity", () => {
    assert.equal(parseTimeseriesGranularity("week").ok, false);
  });
});

function mockFlowGraph(period: Period, account?: string): FlowGraph {
  return {
    period,
    account: account ?? null,
    source: "fixture",
    sourceTimestamp: "2026-08-03T12:00:00.000Z",
    isPeriodComplete: false,
    nodes: [
      { id: "GAAA", label: "GAAA", kind: "account" },
      { id: "GBBB", label: "GBBB", kind: "account" },
    ],
    edges: [
      { source: "GAAA", target: "GBBB", value: 42, asset: "XLM" },
    ],
    totals: { value: 42, edges: 1 },
  };
}

describe("parseFlowQuery", () => {
  test("defaults to 1d when period absent", () => {
    assert.deepEqual(parseFlowQuery(new URLSearchParams()), {
      ok: true,
      period: "1d",
      account: undefined,
    });
  });

  test("rejects invalid period", () => {
    assert.equal(
      parseFlowQuery(new URLSearchParams("period=1y")).ok,
      false,
    );
  });
});

describe("GET /api/v1/timeseries", () => {
  test("returns 200 for supported periods", async () => {
    for (const period of supportedPeriods) {
      const response = await handleTimeseriesRequest(
        new Request(`http://localhost/api/v1/timeseries?period=${period}`),
        async (requestedPeriod) => mockTimeseriesResponse(requestedPeriod),
      );

      assert.equal(response.status, 200);
      const body = (await response.json()) as TimeseriesResponse;
      assert.equal(body.period, period);
      assert.ok(body.metricProvenance.operation_count);
      assert.ok(Array.isArray(body.buckets));
    }
  });

  test("returns 400 for invalid period without invoking provider", async () => {
    let calls = 0;
    const response = await handleTimeseriesRequest(
      new Request("http://localhost/api/v1/timeseries?period=1y"),
      async () => {
        calls += 1;
        return mockTimeseriesResponse("1d");
      },
    );

    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });

  test("returns 400 for invalid granularity", async () => {
    const response = await handleTimeseriesRequest(
      new Request("http://localhost/api/v1/timeseries?period=7d&granularity=week"),
      async () => mockTimeseriesResponse("7d"),
    );

    assert.equal(response.status, 400);
  });

  test("returns safe provider error response", async () => {
    const response = await handleTimeseriesRequest(
      new Request("http://localhost/api/v1/timeseries?period=30d"),
      async () => {
        throw new Error("BigQuery query failed with backend detail");
      },
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    });
  });
});

describe("timeseries cache headers", () => {
  test("in-progress periods get a shorter shared TTL than complete periods", async () => {
    const inProgress = await handleTimeseriesRequest(
      new Request("http://localhost/api/v1/timeseries?period=1d"),
      async (period) => ({
        ...mockTimeseriesResponse(period),
        isPeriodComplete: false,
      }),
    );
    const complete = await handleTimeseriesRequest(
      new Request("http://localhost/api/v1/timeseries?period=30d"),
      async (period) => ({
        ...mockTimeseriesResponse(period),
        isPeriodComplete: true,
      }),
    );

    assert.equal(inProgress.status, 200);
    assert.equal(complete.status, 200);
    assert.equal(
      inProgress.headers.get("cache-control"),
      "public, max-age=60, s-maxage=60",
    );
    assert.equal(
      complete.headers.get("cache-control"),
      "public, max-age=900, s-maxage=900",
    );
  });

  test("mirrors the shared TTL onto CDN cache headers", async () => {
    const response = await handleTimeseriesRequest(
      new Request("http://localhost/api/v1/timeseries?period=7d"),
      async (period) => ({
        ...mockTimeseriesResponse(period),
        isPeriodComplete: true,
      }),
    );

    const cacheControl = response.headers.get("cache-control");
    assert.equal(response.headers.get("cdn-cache-control"), cacheControl);
    assert.equal(
      response.headers.get("vercel-cdn-cache-control"),
      cacheControl,
    );
  });

  test("never caches error responses", async () => {
    const invalid = await handleTimeseriesRequest(
      new Request("http://localhost/api/v1/timeseries?period=1y"),
      async (period) => mockTimeseriesResponse(period),
    );

    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get("cache-control"), "no-store");
  });
});

