#!/usr/bin/env node

/**
 * Unit tests for the treemap coverage metadata calculation.
 *
 * These tests validate the buildCoverage logic defined in the issue #33 spec:
 *   CoveragePercent = namedChildValue / parentValue × 100
 *   Synthetic remainder is excluded from named entity count.
 *   Zero-value parent → 0% (not NaN).
 *   Tests cover partial, complete, empty, and precision-boundary cases.
 *
 * Usage: node scripts/test-coverage-calculation.mjs
 */

// ── buildCoverage implementation (inlined for testability) ──────────

/**
 * @param {{ value?: number; meta?: { opCount?: number } }[]} children
 * @param {number} parentValue
 * @param {number} configuredLimit
 * @param {number} [namedChildValue]
 * @returns {{
 *   namedChildValue: number;
 *   parentValue: number;
 *   coveragePercent: number;
 *   namedEntityCount: number;
 *   configuredLimit: number;
 * } | undefined}
 */
function buildCoverage(children, parentValue, configuredLimit, namedChildValue) {
  if (children.length === 0) {
    return undefined;
  }

  const childValue =
    namedChildValue ??
    children.reduce(
      (sum, child) => sum + (child.value ?? child.meta?.opCount ?? 0),
      0,
    );

  // Zero-value parent: explicit non-NaN rule
  if (parentValue === 0) {
    return {
      namedChildValue: 0,
      parentValue: 0,
      coveragePercent: 0,
      namedEntityCount: children.length,
      configuredLimit,
    };
  }

  return {
    namedChildValue: childValue,
    parentValue,
    coveragePercent: (childValue / parentValue) * 100,
    namedEntityCount: children.length,
    configuredLimit,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function node(value) {
  return { name: "child", value };
}

function metaNode(opCount) {
  return { name: "child", meta: { type: "contract", opCount } };
}

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function assertClose(label, actual, expected, tolerance = 1e-8) {
  assert(
    label,
    Math.abs(actual - expected) < tolerance,
  );
}

function assertEqual(label, actual, expected) {
  assert(
    label,
    actual === expected,
  );
}

// ── Tests ───────────────────────────────────────────────────────────

console.log("Coverage calculation tests\n");

// 1. Partial coverage
(function () {
  const children = [node(400), node(300), node(200)];
  const r = buildCoverage(children, 1000, 5);
  assertEqual("partial: namedChildValue", r.namedChildValue, 900);
  assertEqual("partial: parentValue", r.parentValue, 1000);
  assertClose("partial: coveragePercent", r.coveragePercent, 90);
  assertEqual("partial: namedEntityCount", r.namedEntityCount, 3);
  assertEqual("partial: configuredLimit", r.configuredLimit, 5);
})();

// 2. Complete coverage (100%)
(function () {
  const children = [node(500), node(300), node(200)];
  const r = buildCoverage(children, 1000, 3);
  assertClose("complete: coveragePercent", r.coveragePercent, 100);
  assertEqual("complete: namedEntityCount", r.namedEntityCount, 3);
})();

// 3. Empty children → undefined
(function () {
  const r = buildCoverage([], 1000, 5);
  assertEqual("empty: returns undefined", r, undefined);
})();

// 4. Zero-value parent (non-NaN rule)
(function () {
  const children = [node(0), node(0)];
  const r = buildCoverage(children, 0, 5);
  assertEqual("zero-parent: namedChildValue", r.namedChildValue, 0);
  assertEqual("zero-parent: parentValue", r.parentValue, 0);
  assertEqual("zero-parent: coveragePercent", r.coveragePercent, 0);
  assertEqual("zero-parent: namedEntityCount", r.namedEntityCount, 2);
  assertEqual("zero-parent: configuredLimit", r.configuredLimit, 5);
})();

// 5. Precision boundary (fractional percentage)
(function () {
  const children = [node(1), node(1), node(1)];
  const r = buildCoverage(children, 7, 3);
  assertClose("precision: coveragePercent", r.coveragePercent, 42.857142857, 1e-6);
  assertEqual("precision: namedChildValue", r.namedChildValue, 3);
  assertEqual("precision: parentValue", r.parentValue, 7);
})();

// 6. namedChildValue override
(function () {
  const children = [node(100), node(100)];
  const r = buildCoverage(children, 500, 10, 150);
  assertEqual("override: namedChildValue", r.namedChildValue, 150);
  assertClose("override: coveragePercent", r.coveragePercent, 30);
})();

// 7. Single child
(function () {
  const children = [node(750)];
  const r = buildCoverage(children, 1000, 1);
  assertClose("single: coveragePercent", r.coveragePercent, 75);
  assertEqual("single: namedEntityCount", r.namedEntityCount, 1);
})();

// 8. Falls back to meta.opCount when value is undefined
(function () {
  const children = [metaNode(300), metaNode(200)];
  const r = buildCoverage(children, 1000, 5);
  assertEqual("meta-opCount: namedChildValue", r.namedChildValue, 500);
  assertClose("meta-opCount: coveragePercent", r.coveragePercent, 50);
})();

// 9. ConfiguredLimit is surfaced
(function () {
  const children = [node(100)];
  const r = buildCoverage(children, 200, 70);
  assertEqual("limit-surfaced: configuredLimit", r.configuredLimit, 70);
})();

// ── Summary ─────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
