import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TRUSTLINE_VELOCITY_FIXTURE,
  TRUSTLINE_VELOCITY_RANGE,
} from "./trustline-velocity-fixture";
import { buildTrustlineVelocity } from "./trustline-velocity";

describe("trustline create and remove classification", () => {
  it("buckets by UTC day inside the period and ignores other operations", () => {
    const result = buildTrustlineVelocity(TRUSTLINE_VELOCITY_FIXTURE, TRUSTLINE_VELOCITY_RANGE);
    assert.deepEqual(result, {
      status: "ready",
      buckets: [
        { bucket: "2026-11-20", create: 5, remove: 2 },
        { bucket: "2026-11-21", create: 4, remove: 0 },
      ],
      net: 7,
    });
  });

  it("soft-fails when a change_trust row has no limit", () => {
    const result = buildTrustlineVelocity(
      [{ closedAt: "2026-11-20T01:00:00.000Z", type: "change_trust", count: 1 }],
      TRUSTLINE_VELOCITY_RANGE,
    );
    assert.equal(result.status, "unavailable");
  });

  it("soft-fails when the series itself is missing", () => {
    assert.equal(buildTrustlineVelocity(null, TRUSTLINE_VELOCITY_RANGE).status, "unavailable");
  });
});
