import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFixtureContractInvokeSuccess,
  loadContractInvokeSuccess,
  mapContractInvokeOutcomeRow,
} from "./contract-invoke-success";

describe("Soroban invoke success vs failure rate in entity details (#450)", () => {
  it("maps fixture contract outcome counts and produces accessible text summary", () => {
    const res = getFixtureContractInvokeSuccess("CCONTRACT123");
    assert.equal(res.status, "available");
    if (res.status === "available") {
      assert.equal(res.successfulCount, 4910);
      assert.equal(res.failedCount, 90);
      assert.equal(res.totalCount, 5000);
      assert.equal(res.successRatePercent, 98.2);
      assert.equal(res.failureRatePercent, 1.8);
      assert.ok(
        res.accessibleSummary.includes(
          "98.2% succeeded (4,910 succeeded · 90 failed of 5,000 invokes)",
        ),
      );
    }
  });

  it("soft-fails to unavailable for null, malformed, or zero-count rows", () => {
    assert.equal(
      mapContractInvokeOutcomeRow("CCONTRACT123", null).status,
      "unavailable",
    );
    assert.equal(
      mapContractInvokeOutcomeRow("CCONTRACT123", {
        successful_count: "not-a-number",
        failed_count: 10,
      }).status,
      "unavailable",
    );
    assert.equal(
      mapContractInvokeOutcomeRow("CCONTRACT123", {
        successful_count: 0,
        failed_count: 0,
      }).status,
      "unavailable",
    );
  });

  it("soft-fails without throwing when live query drifts or rejects", async () => {
    const res = await loadContractInvokeSuccess("CCONTRACT123", async () => {
      throw new Error("Column successful_count not found");
    });
    assert.equal(res.status, "unavailable");
    assert.ok(res.accessibleSummary.includes("Unavailable"));
  });
});
