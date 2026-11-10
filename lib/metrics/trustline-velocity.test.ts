import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTrustlineVelocityFixture,
  classifyChangeTrustAction,
  mapTrustlineVelocityBuckets,
} from "@/lib/metrics/trustline-velocity";

describe("Trustline creation and removal velocity (#449)", () => {
  it("classifies change_trust limits into create (>0) and remove (0)", () => {
    assert.equal(
      classifyChangeTrustAction({
        type_string: "change_trust",
        limit: "922337203685.4775807",
      }),
      "create",
    );
    assert.equal(
      classifyChangeTrustAction({
        type_string: "change_trust",
        limit: "0.0000000",
      }),
      "remove",
    );
    assert.equal(
      classifyChangeTrustAction({
        type_string: "change_trust",
        limit: 0,
      }),
      "remove",
    );
    assert.equal(
      classifyChangeTrustAction({
        type_string: "payment",
        limit: "100",
      }),
      null,
    );
    assert.equal(
      classifyChangeTrustAction({
        type_string: "change_trust",
        limit: null,
      }),
      null,
    );
  });

  it("aggregates raw limit rows by UTC bucket and computes net trustline change", () => {
    const summary = mapTrustlineVelocityBuckets({
      period: "1d",
      rows: [
        {
          bucket_utc: "2026-01-01T06:00:00Z",
          type_string: "change_trust",
          limit: "1000.0",
          op_count: 300,
        },
        {
          bucket_utc: "2026-01-01T06:00:00Z",
          type_string: "change_trust",
          limit: "0",
          op_count: 120,
        },
        {
          bucket_utc: "2026-01-01T00:00:00Z",
          type_string: "change_trust",
          limit: "500.0",
          op_count: 200,
        },
      ],
    });

    assert.equal(summary.status, "available");
    assert.equal(summary.totalCreated, 500);
    assert.equal(summary.totalRemoved, 120);
    assert.equal(summary.netTrustlineChange, 380);
    assert.deepEqual(
      summary.buckets.map((b) => b.bucketUtc),
      ["2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z"],
    );
  });

  it("soft-fails when trustline limit subtypes are unavailable", () => {
    const summary = mapTrustlineVelocityBuckets({
      period: "7d",
      rows: [{ bucket_utc: "2026-01-01T00:00:00Z", type_string: "change_trust" }],
    });
    assert.equal(summary.status, "unavailable");
    assert.equal(summary.reason, "subtype_unavailable");
  });

  it("builds deterministic fixture dataset with positive net trustline change", () => {
    const fixture = buildTrustlineVelocityFixture("7d");
    assert.equal(fixture.status, "available");
    assert.equal(fixture.totalCreated, 7300);
    assert.equal(fixture.totalRemoved, 2300);
    assert.equal(fixture.netTrustlineChange, 5000);
    assert.equal(fixture.buckets.length, 4);
  });
});
