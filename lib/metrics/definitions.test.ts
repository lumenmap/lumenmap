import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DASHBOARD_METRIC_IDS,
  METRIC_DEFINITIONS,
  getMetricDefinition,
} from "@/lib/metrics/definitions";
import {
  METHODOLOGY_SECTIONS,
  getMethodologySection,
  methodologyPath,
} from "@/lib/metrics/methodology";

describe("dashboard metric definitions", () => {
  it("defines every selectable KPI metric", () => {
    assert.deepEqual(DASHBOARD_METRIC_IDS.sort(), [
      "activeContracts",
      "sorobanShare",
      "topCategory",
      "totalOps",
    ]);
  });

  it("exposes definition, unit, limitation, and methodology target", () => {
    for (const id of DASHBOARD_METRIC_IDS) {
      const metric = getMetricDefinition(id);
      assert.ok(metric.definition.length > 20, id);
      assert.ok(metric.unit.length > 0, id);
      assert.ok(metric.limitation.length > 10, id);
      assert.equal(
        metric.methodologyHref,
        methodologyPath(metric.methodologySection),
      );
      assert.equal(
        metric.methodologyHref,
        `/methodology#${metric.methodologySection}`,
      );
      // Ensure the target section exists.
      const section = getMethodologySection(metric.methodologySection);
      assert.equal(section.id, metric.methodologySection);
      assert.ok(section.unit.length > 0);
      assert.ok(section.limitations.length > 0);
    }
  });

  it("does not use marketing claims as methodology copy", () => {
    const banned = [/best[ -]?in[ -]?class/i, /unmatched/i, /guaranteed/i];
    for (const metric of Object.values(METRIC_DEFINITIONS)) {
      for (const pattern of banned) {
        assert.equal(pattern.test(metric.definition), false, metric.id);
        assert.equal(pattern.test(metric.limitation), false, metric.id);
      }
    }
    for (const section of METHODOLOGY_SECTIONS) {
      for (const pattern of banned) {
        assert.equal(pattern.test(section.summary), false, section.id);
      }
    }
  });
});

describe("methodology sections", () => {
  it("covers operations, transactions, volume, TVL, and active entities", () => {
    const ids = METHODOLOGY_SECTIONS.map((section) => section.id);
    const required = [
      "operations",
      "transactions",
      "payment-volume",
      "tvl",
      "active-accounts",
      "active-contracts",
    ] as const;
    for (const id of required) {
      assert.ok(ids.includes(id), id);
    }
  });
});
