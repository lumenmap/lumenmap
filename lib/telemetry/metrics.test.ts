import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { metrics } from "@/lib/telemetry/metrics";
import { RESPONSE_SIZE_UNIT } from "@/lib/telemetry/types";

beforeEach(() => {
  metrics.reset();
});

describe("MetricsRegistry", () => {
  describe("counters", () => {
    it("records a cache hit counter", () => {
      metrics.increment({ endpoint: "activity", cache_outcome: "hit" });
      assert.equal(
        metrics.readCounter({ endpoint: "activity", cache_outcome: "hit" }),
        1,
      );
    });

    it("records a cache miss counter", () => {
      metrics.increment({ endpoint: "activity", cache_outcome: "miss" });
      assert.equal(
        metrics.readCounter({ endpoint: "activity", cache_outcome: "miss" }),
        1,
      );
    });

    it("records a coalesced counter", () => {
      metrics.increment({ endpoint: "activity", cache_outcome: "coalesced" });
      assert.equal(
        metrics.readCounter({
          endpoint: "activity",
          cache_outcome: "coalesced",
        }),
        1,
      );
    });

    it("distinguishes hit, miss, and coalesced outcomes", () => {
      metrics.increment({ endpoint: "activity", cache_outcome: "hit" });
      metrics.increment({ endpoint: "activity", cache_outcome: "miss" });
      metrics.increment({ endpoint: "activity", cache_outcome: "coalesced" });

      assert.equal(
        metrics.readCounter({ endpoint: "activity", cache_outcome: "hit" }),
        1,
      );
      assert.equal(
        metrics.readCounter({ endpoint: "activity", cache_outcome: "miss" }),
        1,
      );
      assert.equal(
        metrics.readCounter({
          endpoint: "activity",
          cache_outcome: "coalesced",
        }),
        1,
      );
    });

    it("increments the same counter on repeated hits", () => {
      metrics.increment({ endpoint: "activity", cache_outcome: "hit" });
      metrics.increment({ endpoint: "activity", cache_outcome: "hit" });
      assert.equal(
        metrics.readCounter({ endpoint: "activity", cache_outcome: "hit" }),
        2,
      );
    });

    it("returns zero for unseen counters", () => {
      assert.equal(
        metrics.readCounter({ endpoint: "activity", cache_outcome: "miss" }),
        0,
      );
    });
  });

  describe("histograms", () => {
    it("records a single response-size observation", () => {
      metrics.record({ endpoint: "activity", period: "1d" }, 42);
      const result = metrics.readHistogram({
        endpoint: "activity",
        period: "1d",
      });
      assert.deepEqual(result, { count: 1, sum: 42, min: 42, max: 42 });
    });

    it("aggregates multiple observations", () => {
      metrics.record({ endpoint: "activity", period: "1d" }, 100);
      metrics.record({ endpoint: "activity", period: "1d" }, 200);
      metrics.record({ endpoint: "activity", period: "1d" }, 300);

      const result = metrics.readHistogram({
        endpoint: "activity",
        period: "1d",
      });
      assert.deepEqual(result, { count: 3, sum: 600, min: 100, max: 300 });
    });

    it("keeps period series independent", () => {
      metrics.record({ endpoint: "activity", period: "1d" }, 100);
      metrics.record({ endpoint: "activity", period: "7d" }, 500);

      assert.deepEqual(
        metrics.readHistogram({ endpoint: "activity", period: "1d" }),
        { count: 1, sum: 100, min: 100, max: 100 },
      );
      assert.deepEqual(
        metrics.readHistogram({ endpoint: "activity", period: "7d" }),
        { count: 1, sum: 500, min: 500, max: 500 },
      );
    });

    it("returns null for unseen histograms", () => {
      assert.equal(
        metrics.readHistogram({ endpoint: "activity", period: "1d" }),
        null,
      );
    });

    it("records response sizes with HTTP status class", () => {
      const bytes = 2048;
      metrics.record(
        { endpoint: "activity", period: "1d", status: "2xx" },
        bytes,
      );
      const result = metrics.readHistogram({
        endpoint: "activity",
        period: "1d",
        status: "2xx",
      });
      assert.equal(result?.sum, bytes);
      assert.equal(RESPONSE_SIZE_UNIT, "bytes");
    });
  });
});
