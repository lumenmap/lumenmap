import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEE_PRESSURE_FIXTURE_CLASSIC_TOTAL_STROOPS,
  FEE_PRESSURE_FIXTURE_SOROBAN_RESOURCE_TOTAL_STROOPS,
  buildFeePressureFixture,
  computeSeriesCorrelation,
  mapFeePressureRows,
  unavailableFeePressure,
} from "@/lib/soroban-fees/fee-pressure";

describe("Network fee pressure mapper and fixture", () => {
  it("builds documented fixture numbers in stroops with positive op-count correlation", () => {
    const fixture = buildFeePressureFixture("7d");
    assert.equal(fixture.status, "available");
    assert.equal(fixture.unit, "stroops");
    assert.equal(fixture.classicAvailable, true);
    assert.equal(fixture.sorobanAvailable, true);
    assert.equal(
      fixture.totalClassicFeeStroops,
      FEE_PRESSURE_FIXTURE_CLASSIC_TOTAL_STROOPS,
    );
    assert.equal(
      fixture.totalSorobanResourceFeeStroops,
      FEE_PRESSURE_FIXTURE_SOROBAN_RESOURCE_TOTAL_STROOPS,
    );
    assert.equal(fixture.peakFeeStroops, 440_000_000);
    assert.equal(fixture.peakOpCount, 18_500);
    assert.ok(
      fixture.opFeeCorrelation !== null && fixture.opFeeCorrelation > 0.95,
    );
    assert.equal(fixture.points.length, 4);
  });

  it("marks both_unavailable when both classic and Soroban series are missing", () => {
    const summary = mapFeePressureRows({
      period: "1d",
      rows: [
        {
          bucket_start: "2026-01-01T00:00:00.000Z",
          classic_fee_stroops: null,
          soroban_resource_fee_stroops: null,
          op_count: 1200,
        },
      ],
    });
    assert.equal(summary.status, "unavailable");
    assert.equal(summary.reason, "both_unavailable");
    assert.equal(summary.classicAvailable, false);
    assert.equal(summary.sorobanAvailable, false);
  });

  it("remains available when only one series is present", () => {
    const summary = mapFeePressureRows({
      period: "7d",
      classicAvailable: false,
      sorobanAvailable: true,
      rows: [
        {
          bucket_start: "2026-01-01T00:00:00.000Z",
          classic_fee_stroops: 50_000,
          soroban_resource_fee_stroops: 120_000,
          op_count: 400,
        },
        {
          bucket_start: "2026-01-01T01:00:00.000Z",
          classic_fee_stroops: 70_000,
          soroban_resource_fee_stroops: 240_000,
          op_count: 800,
        },
      ],
    });
    assert.equal(summary.status, "available");
    assert.equal(summary.classicAvailable, false);
    assert.equal(summary.sorobanAvailable, true);
    assert.equal(summary.totalClassicFeeStroops, null);
    assert.equal(summary.totalSorobanResourceFeeStroops, 360_000);
    assert.equal(summary.opFeeCorrelation, 1);
  });

  it("soft-fails schema drift errors without throwing", () => {
    const summary = unavailableFeePressure({
      period: "30d",
      error: new Error(
        "Unrecognized name: total_non_refundable_resource_fee at [2:5]",
      ),
    });
    assert.equal(summary.status, "unavailable");
    assert.equal(summary.reason, "schema_drift");
    assert.match(summary.message ?? "", /not available/);
  });

  it("returns null correlation when series has fewer than 2 points or zero variance", () => {
    assert.equal(computeSeriesCorrelation([100], [10]), null);
    assert.equal(computeSeriesCorrelation([100, 100], [10, 20]), null);
  });
});
