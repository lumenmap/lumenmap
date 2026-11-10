import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeInvokeOutcomeSummary,
  resolveContractInvokeOutcomes,
} from "./invoke-success-rate";

describe("Soroban invoke success vs failure rate", () => {
  it("computes success and failure percentages from explicit counts", () => {
    const summary = computeInvokeOutcomeSummary({
      successfulInvokes: 950,
      failedInvokes: 50,
    });
    assert.equal(summary.status, "ok");
    assert.equal(summary.totalInvokes, 1000);
    assert.equal(summary.successfulInvokes, 950);
    assert.equal(summary.failedInvokes, 50);
    assert.equal(summary.successRatePercent, 95);
    assert.equal(summary.failureRatePercent, 5);
  });

  it("derives successful invokes when totalInvokes and failedInvokes are provided", () => {
    const summary = computeInvokeOutcomeSummary({
      totalInvokes: 200,
      failedInvokes: 25,
    });
    assert.equal(summary.status, "ok");
    assert.equal(summary.successfulInvokes, 175);
    assert.equal(summary.failedInvokes, 25);
    assert.equal(summary.successRatePercent, 87.5);
    assert.equal(summary.failureRatePercent, 12.5);
  });

  it("returns unavailable when no invoke counts exist", () => {
    const empty = computeInvokeOutcomeSummary({});
    assert.equal(empty.status, "unavailable");
    assert.equal(empty.totalInvokes, 0);

    const zero = resolveContractInvokeOutcomes(undefined, 0);
    assert.equal(zero.status, "unavailable");
  });

  it("resolves contract invoke outcomes from node meta or function breakdown total", () => {
    const resolved = resolveContractInvokeOutcomes(
      { opCount: 400, failedInvokes: 20 },
      350,
    );
    assert.equal(resolved.status, "ok");
    assert.equal(resolved.totalInvokes, 400);
    assert.equal(resolved.successfulInvokes, 380);
    assert.equal(resolved.failedInvokes, 20);
    assert.equal(resolved.successRatePercent, 95);
    assert.equal(resolved.failureRatePercent, 5);
  });
});
