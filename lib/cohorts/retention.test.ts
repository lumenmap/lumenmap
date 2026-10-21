import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bucketRetentionCohorts, retentionRate } from "@/lib/cohorts/retention";
import { retentionCohortFixture } from "@/lib/fixtures/retention-cohorts";

describe("bucketRetentionCohorts", () => {
  it("counts a wallet once per week and measures later return", () => {
    const buckets = bucketRetentionCohorts(retentionCohortFixture, 4);
    const week0 = buckets[0];

    assert.equal(week0.size, 3);
    assert.deepEqual(week0.retained, [3, 1, 2, 1]);
    assert.equal(retentionRate(week0, 0), 1);
    assert.equal(retentionRate(week0, 1), 1 / 3);
  });

  it("ignores weeks outside the window and blank wallet ids", () => {
    const buckets = bucketRetentionCohorts(
      [
        { walletId: "  ", weekIndex: 0 },
        { walletId: "kept", weekIndex: 0 },
        { walletId: "late", weekIndex: 9 },
      ],
      4,
    );

    assert.equal(buckets[0].size, 1);
    assert.equal(buckets[0].retained[0], 1);
  });

  it("caps cohort membership and marks the sample", () => {
    const events = Array.from({ length: 5 }, (_, index) => ({
      walletId: `w-${index}`,
      weekIndex: 0,
    }));
    const [bucket] = bucketRetentionCohorts(events, 2, 2);

    assert.equal(bucket.size, 2);
    assert.equal(bucket.sampled, true);
  });

  it("returns null rates for an empty cohort", () => {
    const [bucket] = bucketRetentionCohorts([], 2);
    assert.equal(bucket.size, 0);
    assert.equal(retentionRate(bucket, 0), null);
  });
});
