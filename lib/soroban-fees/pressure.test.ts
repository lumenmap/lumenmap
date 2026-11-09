import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NetworkFeePressurePanel } from "@/components/dashboard/NetworkFeePressurePanel";
import {
  getFixtureFeePressureAnalytics,
  loadFeePressureAnalytics,
  mapFeePressureRows,
} from "./pressure";

describe("Network fee pressure panel for classic and Soroban (#456)", () => {
  it("maps fixture classic and Soroban fee pressure series with stroops unit", () => {
    const fixture = getFixtureFeePressureAnalytics("7d");
    assert.equal(fixture.status, "available");
    assert.equal(fixture.unit, "stroops");
    assert.equal(fixture.classicAvailable, true);
    assert.equal(fixture.sorobanAvailable, true);
    assert.equal(fixture.peakClassicMedianStroops, 250);
    assert.equal(fixture.peakSorobanResourceStroops, 210_400_000);
    assert.equal(fixture.buckets.length, 3);
  });

  it("soft-fails without throwing on schema drift or upstream query error", async () => {
    const result = await loadFeePressureAnalytics("1d", async () => {
      throw new Error("Unrecognized name: classic_median_fee_stroops");
    });
    assert.equal(result.status, "unavailable");
    assert.equal(result.classicAvailable, false);
    assert.equal(result.sorobanAvailable, false);
    assert.equal(result.buckets.length, 0);
  });

  it("hides panel when both classic and Soroban fee series are unavailable", () => {
    const empty = mapFeePressureRows(
      [{ bucket_timestamp: "2026-10-01T00:00:00Z", op_count: 500 }],
      "1d",
    );
    assert.equal(empty.status, "unavailable");
    assert.equal(NetworkFeePressurePanel({ analytics: empty }), null);

    const rendered = NetworkFeePressurePanel({
      analytics: getFixtureFeePressureAnalytics("1d"),
    });
    assert.notEqual(rendered, null);
  });
});
