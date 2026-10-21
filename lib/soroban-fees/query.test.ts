import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadSorobanFeeAnalytics,
  querySorobanFeeAnalytics,
} from "@/lib/soroban-fees/query";
import {
  SOROBAN_FEE_FIXTURE_AVG_RESOURCE_STROOPS,
  SOROBAN_FEE_FIXTURE_TOTAL_STROOPS,
} from "@/lib/soroban-fees/fixture";

describe("querySorobanFeeAnalytics", () => {
  it("maps null summary rows without throwing", async () => {
    const result = await querySorobanFeeAnalytics({
      period: "1d",
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-02T00:00:00.000Z",
      runQuery: async (sql) => {
        if (sql.includes("GROUP BY contract_id")) return [null];
        return [
          {
            total_fee_stroops: null,
            invoke_count: null,
            resource_stroops: null,
          },
        ];
      },
    });
    assert.equal(result.status, "available");
    if (result.status !== "available") return;
    assert.equal(result.totalFeeStroops, 0);
    assert.equal(result.avgResourceStroopsPerInvoke, null);
    assert.deepEqual(result.topContracts, []);
  });

  it("returns schema_drift when a fee column is missing", async () => {
    const result = await querySorobanFeeAnalytics({
      period: "7d",
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-08T00:00:00.000Z",
      runQuery: async () => {
        throw new Error(
          "Unrecognized name: total_non_refundable_resource_fee at [3:7]",
        );
      },
    });
    assert.equal(result.status, "unavailable");
    if (result.status !== "unavailable") return;
    assert.equal(result.reason, "schema_drift");
    assert.match(result.message, /not available/);
  });

  it("returns query_failed for other live errors", async () => {
    const result = await querySorobanFeeAnalytics({
      period: "30d",
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-31T00:00:00.000Z",
      runQuery: async () => {
        throw new Error("BigQuery client is not configured");
      },
    });
    assert.equal(result.status, "unavailable");
    if (result.status !== "unavailable") return;
    assert.equal(result.reason, "query_failed");
  });
});

describe("loadSorobanFeeAnalytics fixture mode", () => {
  it("returns the documented sample and does not call BigQuery", async () => {
    let called = false;
    const result = await loadSorobanFeeAnalytics({
      period: "7d",
      now: new Date("2026-02-01T12:00:00.000Z"),
      env: { LUMENMAP_DATA_SOURCE: "fixture", NODE_ENV: "test" },
      runQuery: async () => {
        called = true;
        return [];
      },
    });
    assert.equal(called, false);
    assert.equal(result.status, "available");
    if (result.status !== "available") return;
    assert.equal(result.source, "fixture");
    assert.equal(result.totalFeeStroops, SOROBAN_FEE_FIXTURE_TOTAL_STROOPS);
    assert.equal(
      result.avgResourceStroopsPerInvoke,
      SOROBAN_FEE_FIXTURE_AVG_RESOURCE_STROOPS,
    );
    assert.equal(result.topContracts.length, 3);
  });
});
