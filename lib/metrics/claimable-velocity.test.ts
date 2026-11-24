import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLAIMABLE_VELOCITY_EMPTY_FIXTURE,
  CLAIMABLE_VELOCITY_FIXTURE,
  CLAIMABLE_VELOCITY_RANGE,
} from "./claimable-velocity-fixture";
import {
  buildClaimableVelocity,
  classifyClaimableOperation,
  isClaimableVelocityEmpty,
} from "./claimable-velocity";

describe("claimable create and claim classification", () => {
  it("maps create and claim types and ignores clawbacks and other ops", () => {
    assert.equal(classifyClaimableOperation("create_claimable_balance"), "create");
    assert.equal(classifyClaimableOperation("claim_claimable_balance"), "claim");
    assert.equal(classifyClaimableOperation("clawback_claimable_balance"), "ignore");
    assert.equal(classifyClaimableOperation("payment"), "ignore");
    assert.equal(classifyClaimableOperation(null), "ignore");
  });

  it("buckets by UTC day inside the period and ignores other operations", () => {
    const result = buildClaimableVelocity(
      CLAIMABLE_VELOCITY_FIXTURE,
      CLAIMABLE_VELOCITY_RANGE,
    );
    assert.deepEqual(result, {
      status: "ready",
      buckets: [
        { bucket: "2026-11-20", create: 6, claim: 3 },
        { bucket: "2026-11-21", create: 2, claim: 4 },
      ],
      net: 1,
    });
  });

  it("reports net outstanding delta as creates minus claims", () => {
    const result = buildClaimableVelocity(
      CLAIMABLE_VELOCITY_FIXTURE,
      CLAIMABLE_VELOCITY_RANGE,
    );
    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.net, 6 + 2 - (3 + 4));
    }
  });

  it("soft-fails when the series itself is missing", () => {
    assert.equal(
      buildClaimableVelocity(null, CLAIMABLE_VELOCITY_RANGE).status,
      "unavailable",
    );
  });

  it("soft-fails when a create/claim row has a bad count", () => {
    const result = buildClaimableVelocity(
      [
        {
          closedAt: "2026-11-20T01:00:00.000Z",
          type: "create_claimable_balance",
          count: -1,
        },
      ],
      CLAIMABLE_VELOCITY_RANGE,
    );
    assert.equal(result.status, "unavailable");
  });

  it("marks zero activity as empty without soft-failing", () => {
    const result = buildClaimableVelocity(
      CLAIMABLE_VELOCITY_EMPTY_FIXTURE,
      CLAIMABLE_VELOCITY_RANGE,
    );
    assert.equal(result.status, "ready");
    assert.equal(isClaimableVelocityEmpty(result), true);
    if (result.status === "ready") {
      assert.deepEqual(result.buckets, []);
      assert.equal(result.net, 0);
    }
  });
});
