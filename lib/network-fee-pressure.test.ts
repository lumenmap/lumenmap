import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classicFeePressureQuery,
  loadFeePressure,
  mapFeePressureRows,
  sorobanResourcePressureQuery,
} from "@/lib/network-fee-pressure";

describe("network fee pressure", () => {
  it("maps BigQuery timestamps and stroops in chronological order", () => {
    assert.deepEqual(mapFeePressureRows([
      { bucket_time: { value: "2026-01-02T00:00:00Z" }, fee_stroops: { value: "250" } },
      null,
      { bucket_time: "2026-01-01T00:00:00Z", fee_stroops: 125 },
      { bucket_time: "bad", fee_stroops: 400 },
      { bucket_time: Symbol("unexpected timestamp"), fee_stroops: 400 },
      { bucket_time: "2026-01-03T00:00:00Z", fee_stroops: null },
      { bucket_time: "2026-01-04T00:00:00Z", fee_stroops: "invalid" },
    ]), [
      { timestamp: "2026-01-01T00:00:00.000Z", stroops: 125 },
      { timestamp: "2026-01-02T00:00:00.000Z", stroops: 250 },
    ]);
  });

  it("queries each series independently and keeps the available one", async () => {
    const seen: string[] = [];
    const result = await loadFeePressure({
      period: "7d", now: new Date("2026-01-07T12:00:00Z"),
      env: { LUMENMAP_DATA_SOURCE: "live" },
      runQuery: async (sql) => {
        seen.push(sql);
        if (sql.includes("history_transactions")) throw new Error("Unrecognized name: fee_charged");
        return [{ bucket_time: "2026-01-05T00:00:00Z", fee_stroops: "18000" }];
      },
    });
    assert.equal(result.classic, null);
    assert.deepEqual(result.soroban, [{ timestamp: "2026-01-05T00:00:00.000Z", stroops: 18000 }]);
    assert.equal(result.granularity, "day");
    assert.match(seen[0], /TIMESTAMP_TRUNC\(closed_at, DAY\)/);
    assert.match(seen[1], /TIMESTAMP_TRUNC\(hour_agg, DAY\)/);
  });

  it("returns two unavailable series when both columns drift", async () => {
    const result = await loadFeePressure({
      period: "1d", now: new Date("2026-01-07T12:00:00Z"),
      env: { LUMENMAP_DATA_SOURCE: "live" },
      runQuery: async () => { throw new Error("Unrecognized name"); },
    });
    assert.equal(result.classic, null);
    assert.equal(result.soroban, null);
    assert.equal(result.granularity, "hour");
    assert.match(classicFeePressureQuery("HOUR"), /COALESCE\(resource_fee, 0\) = 0/);
    assert.match(sorobanResourcePressureQuery("HOUR"), /SUM\(total_non_refundable_resource_fee\)/);
  });

  it("returns documented fixture values without querying", async () => {
    const result = await loadFeePressure({
      period: "1d", now: new Date("2026-01-07T16:00:00Z"),
      env: { LUMENMAP_DATA_SOURCE: "fixture", NODE_ENV: "test" },
      runQuery: async () => { throw new Error("should not query"); },
    });
    assert.equal(result.source, "fixture");
    assert.equal(result.classic?.length, 17);
    assert.equal(result.classic?.[0].stroops, 100);
    assert.equal(result.classic?.[14].stroops, 375);
    assert.equal(result.soroban?.[0].stroops, 18_000);
    assert.equal(result.soroban?.[14].stroops, 32_000);
  });

  it("does not show mainnet fee data on live testnet", async () => {
    const result = await loadFeePressure({
      period: "1d", network: "testnet", env: { LUMENMAP_DATA_SOURCE: "live" },
      runQuery: async () => { throw new Error("testnet must not query mainnet tables"); },
    });
    assert.equal(result.classic, null);
    assert.equal(result.soroban, null);
  });
});
