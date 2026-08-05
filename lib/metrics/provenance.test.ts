import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TOP_ACCOUNTS_PER_TYPE,
  TOP_CONTRACT_LIMIT,
} from "@/lib/constants";
import { buildActivityMetricProvenance } from "@/lib/metrics/provenance";

describe("activity metric provenance", () => {
  test("links operation count to its public source and methodology", () => {
    const provenance = buildActivityMetricProvenance().operation_count;

    assert.equal(provenance.metric, "operation_count");
    assert.deepEqual(provenance.methodology, {
      id: "operations",
      version: "1.0.0",
      href: "docs/metric-methodology.md#operations",
    });
    assert.equal(provenance.source.provider, "hubble");
    assert.equal(
      provenance.source.dataset,
      "crypto-stellar.crypto_stellar_dbt",
    );
    assert.deepEqual(provenance.aggregation, {
      kind: "count",
      function: "COUNT(*)",
      granularity: "selected_period",
      dimensions: ["type_string"],
    });
  });

  test("represents coverage limits as discriminated data", () => {
    const constraints =
      buildActivityMetricProvenance().operation_count.coverage.constraints;

    assert.ok(
      constraints.some(
        (constraint) =>
          constraint.kind === "top_n" &&
          constraint.appliesTo === "account_children" &&
          constraint.limit === TOP_ACCOUNTS_PER_TYPE &&
          constraint.partitionBy === "type_string",
      ),
    );
    assert.ok(
      constraints.some(
        (constraint) =>
          constraint.kind === "top_n" &&
          constraint.appliesTo === "contract_children" &&
          constraint.limit === TOP_CONTRACT_LIMIT,
      ),
    );
    assert.ok(
      constraints.some(
        (constraint) =>
          constraint.kind === "partial_period" &&
          constraint.completenessField === "isPeriodComplete",
      ),
    );
  });

  test("serializes without deployment credentials or query text", () => {
    const serialized = JSON.stringify(buildActivityMetricProvenance());
    const sensitiveDetail =
      /credential|service[_ -]?account|project[_ -]?id|\bSELECT\b|GOOGLE_APPLICATION/i;

    assert.doesNotMatch(serialized, sensitiveDetail);
    assert.match(serialized, /enriched_history_operations/);
    assert.match(serialized, /payment-volume/);
  });
});
