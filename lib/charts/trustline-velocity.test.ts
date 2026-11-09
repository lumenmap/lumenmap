import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyTrustlineOperation,
  getFixtureTrustlineVelocity,
  mapTrustlineVelocityRows,
} from "./trustline-velocity";

describe("Trustline creation and removal velocity chart (#449)", () => {
  it("classifies change_trust operations into create vs remove by limit", () => {
    assert.equal(classifyTrustlineOperation("change_trust", "1000"), "create");
    assert.equal(classifyTrustlineOperation("change_trust", 922337203), "create");
    assert.equal(classifyTrustlineOperation("change_trust", 0), "remove");
    assert.equal(classifyTrustlineOperation("change_trust", "0"), "remove");
    assert.equal(classifyTrustlineOperation("payment", 100), "other");
    assert.equal(classifyTrustlineOperation("change_trust", null), "other");
  });

  it("maps UTC buckets, respects period labels, and computes net trustline change", () => {
    const fixture = getFixtureTrustlineVelocity("1d");
    assert.equal(fixture.status, "available");
    assert.equal(fixture.totalCreated, 6100);
    assert.equal(fixture.totalRemoved, 1620);
    assert.equal(fixture.netTrustlineChange, 4480);
    assert.equal(fixture.buckets.length, 3);
    assert.equal(fixture.buckets[0]?.label, "00:00");
  });

  it("soft-fails when trustline operation subtypes are missing", () => {
    const res = mapTrustlineVelocityRows(
      [{ bucket_utc: "2026-10-01T00:00:00Z", type_string: "change_trust", op_count: 500 }],
      "7d",
    );
    assert.equal(res.status, "unavailable");
    assert.equal(res.buckets.length, 0);
  });
});
