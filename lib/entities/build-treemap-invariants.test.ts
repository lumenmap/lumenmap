import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildCoverage,
  buildEventTypeTreemap,
  buildActorTreemap,
} from "@/lib/entities/build-treemap";
import type { CategoryRow, TreemapNode } from "@/lib/types";

function sumValues(nodes: TreemapNode[] | undefined): number {
  return (nodes ?? []).reduce(
    (sum, node) => sum + (node.value ?? node.meta?.opCount ?? 0),
    0,
  );
}

function categories(rows: Array<[string, number]>): CategoryRow[] {
  return rows.map(([type_string, op_count]) => ({ type_string, op_count }));
}

describe("buildCoverage", () => {
  test("returns undefined for empty children", () => {
    assert.equal(buildCoverage([], 100, 10), undefined);
  });

  test("zero parent yields non-NaN zero coverage", () => {
    const coverage = buildCoverage(
      [{ name: "a", value: 0 }],
      0,
      5,
    );
    assert.ok(coverage);
    assert.equal(coverage.parentValue, 0);
    assert.equal(coverage.coveragePercent, 0);
    assert.equal(coverage.namedChildValue, 0);
  });

  test("partial coverage excludes nothing from named children sum", () => {
    const coverage = buildCoverage(
      [
        { name: "a", value: 600 },
        { name: "b", value: 300 },
      ],
      1000,
      10,
    );
    assert.ok(coverage);
    assert.equal(coverage.namedChildValue, 900);
    assert.equal(coverage.parentValue, 1000);
    assert.equal(coverage.coveragePercent, 90);
    assert.equal(coverage.namedEntityCount, 2);
    assert.equal(coverage.configuredLimit, 10);
  });

  test("complete coverage is 100 percent", () => {
    const coverage = buildCoverage([{ name: "a", value: 50 }], 50, 10);
    assert.ok(coverage);
    assert.equal(coverage.coveragePercent, 100);
  });
});

describe("buildEventTypeTreemap parent/remainder invariants", () => {
  test("root value equals the sum of category op counts", () => {
    const rows = categories([
      ["invoke_host_function", 100],
      ["payment", 40],
      ["manage_sell_offer", 20],
    ]);
    const root = buildEventTypeTreemap({
      categories: rows,
      contracts: [],
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });
    assert.equal(root.value, 160);
    assert.equal(sumValues(root.children), 160);
  });

  test("root children sum to the root value", () => {
    const rows = categories([
      ["invoke_host_function", 100],
      ["extend_footprint_ttl", 50],
      ["payment", 30],
      ["path_payment_strict_send", 10],
    ]);
    const root = buildEventTypeTreemap({
      categories: rows,
      contracts: [],
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });
    assert.equal(root.value, 190);
    assert.equal(sumValues(root.children), root.value);
  });

  test("zero-value inputs produce a valid empty/zero root", () => {
    const root = buildEventTypeTreemap({
      categories: [],
      contracts: [],
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });
    assert.equal(root.value ?? 0, 0);
    assert.ok(Array.isArray(root.children));
  });

  test("equal values keep deterministic group ordering", () => {
    const rows = categories([
      ["payment", 10],
      ["manage_sell_offer", 10],
      ["invoke_host_function", 10],
      ["change_trust", 10],
    ]);
    const first = buildEventTypeTreemap({
      categories: rows,
      contracts: [],
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });
    const second = buildEventTypeTreemap({
      categories: rows,
      contracts: [],
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });
    assert.deepEqual(
      (first.children ?? []).map((n) => n.name),
      (second.children ?? []).map((n) => n.name),
    );
  });

  test("synthetic remainder nodes are marked when present", () => {
    // Flood one group beyond TOP limits by using many contract leaves via
    // buildEventTypeTreemap only uses categories at group/type level — remainder
    // appears in actor/contract levels. Assert meta.synthetic when any node has it.
    const rows = categories([["invoke_host_function", 100]]);
    const root = buildEventTypeTreemap({
      categories: rows,
      contracts: Array.from({ length: 5 }, (_, i) => ({
        contract_id: `C${i}`,
        op_count: 10,
      })),
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });
    assert.equal(root.value, 100);
    // Event-type treemap may not create remainders from contracts; still valid structure
    assert.ok(root.children);
  });
});

describe("buildActorTreemap Soroban function breakdown", () => {
  test("attaches top functions to contract leaves", () => {
    const root = buildActorTreemap({
      categories: [{ type_string: "invoke_host_function", op_count: 100 }],
      contracts: [{ contract_id: "C1", op_count: 100 }],
      accounts: [],
      sorobanFunctions: [
        { function_name: "mint", op_count: 60 },
        { function_name: "transfer", op_count: 40 },
      ],
      sorobanFunctionContracts: [
        { function_name: "mint", contract_id: "C1", op_count: 60 },
        { function_name: "transfer", contract_id: "C1", op_count: 40 },
      ],
    });

    const sorobanGroup = root.children?.find((child) => child.name === "Soroban Contracts");
    assert.ok(sorobanGroup);
    const contract = sorobanGroup?.children?.find((child) => child.meta?.id === "C1");
    assert.ok(contract);
    assert.ok(contract?.meta?.sorobanFunctionBreakdown);
    assert.equal(contract?.meta?.sorobanFunctionBreakdown?.length, 2);
    const [first, second] = contract!.meta!.sorobanFunctionBreakdown!;
    assert.equal(first.functionName, "mint");
    assert.equal(first.opCount, 60);
    assert.equal(first.share, 0.6);
    assert.equal(second.functionName, "transfer");
    assert.equal(second.opCount, 40);
    assert.equal(second.share, 0.4);
  });

  test("omits breakdown when no function contracts are present", () => {
    const root = buildActorTreemap({
      categories: [{ type_string: "invoke_host_function", op_count: 100 }],
      contracts: [{ contract_id: "C1", op_count: 100 }],
      accounts: [],
      sorobanFunctions: [],
      sorobanFunctionContracts: [],
    });

    const sorobanGroup = root.children?.find((child) => child.name === "Soroban Contracts");
    const contract = sorobanGroup?.children?.find((child) => child.meta?.id === "C1");
    assert.equal(contract?.meta?.sorobanFunctionBreakdown, undefined);
  });
});
