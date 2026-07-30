import { describe, it, expect } from "vitest";
import {
  buildEventTypeTreemap,
  buildActorTreemap,
  buildAllTreemaps,
  buildKpis,
} from "@/lib/entities/build-treemap";
import type {
  CategoryRow,
  ContractRow,
  AccountRow,
  SorobanFunctionRow,
  SorobanFunctionContractRow,
  TreemapNode,
  EntityInfo,
} from "@/lib/types";
import { GROUP_LABELS, CATEGORY_COLORS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sum all leaf (terminal) node values in a subtree. */
function sumLeaves(node: TreemapNode): number {
  if (!node.children || node.children.length === 0) {
    return node.value ?? 0;
  }
  return node.children.reduce((sum, child) => sum + sumLeaves(child), 0);
}

/** Collect all share values at the root children level. */
function rootShares(root: TreemapNode): number[] {
  return (root.children ?? []).map((c) => c.meta?.share ?? 0);
}

/** Recursively assert parent total === sum of children values. */
function expectParentChildIntegrity(node: TreemapNode, path: string[] = []): void {
  if (!node.children || node.children.length === 0) {
    return;
  }
  const childSum = node.children.reduce(
    (sum, child) => sum + (child.value ?? 0),
    0,
  );
  expect(
    childSum,
    `Parent "${node.name}" value (${node.value}) should equal sum of children (${childSum}) at ${path.join(" > ")}`,
  ).toBe(node.value ?? 0);

  node.children.forEach((child, i) =>
    expectParentChildIntegrity(child, [...path, `[${i}]${child.name}`]),
  );
}

/** Assert share percentages at a given level sum to approximately 100 %. */
function expectSharesSumTo100(root: TreemapNode): void {
  const shares = rootShares(root);
  if (shares.length === 0) return;
  const total = shares.reduce((s, v) => s + v, 0);
  expect(total).toBeCloseTo(100, 1);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function emptyInput(): {
  categories: CategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  labels?: Record<string, EntityInfo>;
} {
  return {
    categories: [],
    contracts: [],
    accounts: [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
  };
}

function mixedCategories(): CategoryRow[] {
  return [
    { type_string: "payment", op_count: 500 },
    { type_string: "manage_buy_offer", op_count: 300 },
    { type_string: "invoke_host_function", op_count: 200 },
    { type_string: "change_trust", op_count: 100 },
    { type_string: "set_options", op_count: 50 },
    { type_string: "inflation", op_count: 10 },
  ];
}

function mixedAccounts(): AccountRow[] {
  return [
    { account_id: "GA5XIG", type_string: "payment", op_count: 250 },
    { account_id: "GA5XIG", type_string: "payment", op_count: 200 },
    { account_id: "GB7YH", type_string: "manage_buy_offer", op_count: 200 },
    { account_id: "GB7YH", type_string: "manage_buy_offer", op_count: 100 },
    { account_id: "GC8ZK", type_string: "change_trust", op_count: 100 },
    { account_id: "GC8ZK", type_string: "payment", op_count: 50 },
  ];
}

function mixedContracts(): ContractRow[] {
  return [
    { contract_id: "CA111", op_count: 120 },
    { contract_id: "CB222", op_count: 80 },
  ];
}

function mixedSorobanFunctions(): SorobanFunctionRow[] {
  return [
    { function_name: "swap", op_count: 150 },
    { function_name: "invoke", op_count: 50 },
  ];
}

function mixedSorobanFunctionContracts(): SorobanFunctionContractRow[] {
  return [
    { function_name: "swap", contract_id: "CA111", op_count: 120 },
    { function_name: "swap", contract_id: "CB222", op_count: 30 },
    { function_name: "invoke", contract_id: "CB222", op_count: 50 },
  ];
}

function fullInput(): {
  categories: CategoryRow[];
  contracts: ContractRow[];
  accounts: AccountRow[];
  sorobanFunctions: SorobanFunctionRow[];
  sorobanFunctionContracts: SorobanFunctionContractRow[];
  labels?: Record<string, EntityInfo>;
} {
  return {
    categories: mixedCategories(),
    contracts: mixedContracts(),
    accounts: mixedAccounts(),
    sorobanFunctions: mixedSorobanFunctions(),
    sorobanFunctionContracts: mixedSorobanFunctionContracts(),
  };
}

const labels: Record<string, EntityInfo> = {
  GA5XIG: { name: "Anchor 1", category: "payments", protocol: "Stellar" },
};

const sorobanLabel: Record<string, EntityInfo> = {
  CA111: { name: "Swap Contract", category: "soroban", protocol: "Soroban" },
};

// ===========================================================================
// buildEventTypeTreemap
// ===========================================================================
describe("buildEventTypeTreemap", () => {
  it("builds a valid treemap with mixed categories", () => {
    const root = buildEventTypeTreemap(fullInput());

    expect(root.name).toBe("Network Activity");
    expect(root.meta?.type).toBe("root");
    expectParentChildIntegrity(root);
    expectSharesSumTo100(root);
  });

  it("groups categories by type-to-group mapping", () => {
    const root = buildEventTypeTreemap(fullInput());
    const groupNames = (root.children ?? []).map((c) => c.name);

    expect(groupNames).toContain(GROUP_LABELS.payments);
    expect(groupNames).toContain(GROUP_LABELS.dex);
    expect(groupNames).toContain(GROUP_LABELS.soroban);
    expect(groupNames).toContain(GROUP_LABELS.trustlines);
    expect(groupNames).toContain(GROUP_LABELS.account);
    expect(groupNames).toContain(GROUP_LABELS.other);
  });

  it("preserves GROUP_ORDER sorting", () => {
    const root = buildEventTypeTreemap(fullInput());
    const expectedOrder = [
      GROUP_LABELS.soroban,
      GROUP_LABELS.payments,
      GROUP_LABELS.dex,
      GROUP_LABELS.trustlines,
      GROUP_LABELS.account,
      GROUP_LABELS.other,
    ];

    const actualOrder = (root.children ?? []).map((c) => c.name);
    const filtered = expectedOrder.filter((name) => actualOrder.includes(name));
    expect(actualOrder).toEqual(filtered);
  });

  it("assigns correct group colors", () => {
    const root = buildEventTypeTreemap(fullInput());
    for (const child of root.children ?? []) {
      const groupKey = child.meta?.category;
      if (groupKey && CATEGORY_COLORS[groupKey]) {
        expect(child.color).toBe(CATEGORY_COLORS[groupKey]);
      }
    }
  });

  it("creates type leaves under each group", () => {
    const root = buildEventTypeTreemap(fullInput());
    const payments = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.payments,
    );
    expect(payments).toBeDefined();
    expect(payments!.children?.length).toBeGreaterThan(0);

    const typeLeaf = payments!.children![0];
    expect(typeLeaf.meta?.type).toBe("entity");
    expect(typeLeaf.meta?.eventType).toBeDefined();
  });

  it("attaches account children to type leaves when accounts exist", () => {
    const root = buildEventTypeTreemap(fullInput());
    const payments = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.payments,
    );
    const payment = payments?.children?.find(
      (c) => c.meta?.eventType === "payment",
    );
    expect(payment?.children?.length).toBeGreaterThan(0);
    expect(payment?.children?.[0].meta?.type).toBe("account");
  });

  it("soroban group contains function leaves", () => {
    const root = buildEventTypeTreemap(fullInput());
    const soroban = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.soroban,
    );
    expect(soroban).toBeDefined();
    expect(soroban!.children?.length).toBe(2);

    const swap = soroban!.children?.find((c) => c.name === "swap");
    expect(swap).toBeDefined();
    expect(swap!.value).toBe(150);
    expect(swap!.meta?.eventType).toBe("swap");

    // Soroban functions should have contract children
    expect(swap!.children?.length).toBe(2);
    expect(swap!.children?.[0].meta?.type).toBe("contract");
  });

  it("handles empty input gracefully", () => {
    const root = buildEventTypeTreemap(emptyInput());
    expect(root.children?.length ?? 0).toBe(0);
    expect(root.value).toBe(0);
    expect(root.meta?.type).toBe("root");
    expectParentChildIntegrity(root);
  });

  it("excludes zero-value groups", () => {
    const input = emptyInput();
    input.categories = [{ type_string: "payment", op_count: 0 }];
    const root = buildEventTypeTreemap(input);
    expect(root.children?.length ?? 0).toBe(0);
  });

  it("handles negative op_count values", () => {
    const input = emptyInput();
    input.categories = [
      { type_string: "payment", op_count: 100 },
      { type_string: "manage_buy_offer", op_count: -50 },
    ];
    const root = buildEventTypeTreemap(input);
    // Negative valued groups with total <= 0 are excluded
    const payments = (root.children ?? []).find(
      (c) => c.meta?.category === "payments",
    );
    expect(payments).toBeDefined();
    expect(payments!.value).toBe(100);
  });

  it("assigns unknown type_string to 'other' group", () => {
    const input = emptyInput();
    input.categories = [
      { type_string: "unknown_op", op_count: 50 },
      { type_string: "another_unknown", op_count: 30 },
    ];
    const root = buildEventTypeTreemap(input);
    const other = (root.children ?? []).find(
      (c) => c.meta?.category === "other",
    );
    expect(other).toBeDefined();
    expect(other!.value).toBe(80);
    expect((other!.children ?? []).length).toBe(2);
  });

  it("preserves deterministic order for equal values", () => {
    const input = emptyInput();
    input.categories = [
      { type_string: "payment", op_count: 100 },
      { type_string: "manage_buy_offer", op_count: 100 },
      { type_string: "change_trust", op_count: 100 },
    ];
    const root1 = buildEventTypeTreemap(input);
    const root2 = buildEventTypeTreemap(input);

    const names1 = (root1.children ?? []).map((c) => c.name);
    const names2 = (root2.children ?? []).map((c) => c.name);
    expect(names1).toEqual(names2);
  });

  it("computes share percentages correctly", () => {
    const input = emptyInput();
    input.categories = [
      { type_string: "payment", op_count: 200 },
      { type_string: "manage_buy_offer", op_count: 200 },
    ];
    const root = buildEventTypeTreemap(input);
    expect(root.meta?.opCount).toBe(400);

    for (const child of root.children ?? []) {
      expect(child.meta?.share).toBeCloseTo(50, 1);
    }
  });
});

// ===========================================================================
// buildActorTreemap
// ===========================================================================
describe("buildActorTreemap", () => {
  it("builds a valid actor treemap with mixed data", () => {
    const root = buildActorTreemap(fullInput());

    expect(root.name).toBe("Network Activity");
    expect(root.meta?.type).toBe("root");
    expectParentChildIntegrity(root);
    expectSharesSumTo100(root);
  });

  it("groups categories correctly", () => {
    const root = buildActorTreemap(fullInput());
    const groupNames = (root.children ?? []).map((c) => c.name);

    expect(groupNames).toContain(GROUP_LABELS.payments);
    expect(groupNames).toContain(GROUP_LABELS.dex);
    expect(groupNames).toContain(GROUP_LABELS.soroban);
    expect(groupNames).toContain(GROUP_LABELS.trustlines);
  });

  it("soroban group contains contract leaves", () => {
    const root = buildActorTreemap(fullInput());
    const soroban = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.soroban,
    );
    expect(soroban).toBeDefined();

    // Actor treemap: soroban shows contracts directly
    expect(soroban!.children?.length).toBe(2);
    for (const contract of soroban!.children ?? []) {
      expect(contract.meta?.type).toBe("contract");
      expect(contract.meta?.category).toBe("soroban");
    }
  });

  it("payment group contains account leaves aggregated by account_id", () => {
    const root = buildActorTreemap(fullInput());
    const payments = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.payments,
    );
    expect(payments).toBeDefined();

    // 2 unique accounts in payments: GA5XIG (500 ops) and GC8ZK (50 ops)
    expect(payments!.children?.length).toBe(2);

    const ga5xig = payments!.children?.find((c) => c.id === "GA5XIG");
    expect(ga5xig).toBeDefined();
    expect(ga5xig!.value).toBe(450);
    expect(ga5xig!.meta?.type).toBe("account");
  });

  it("dex group contains account leaves aggregated by account_id", () => {
    const root = buildActorTreemap(fullInput());
    const dex = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.dex,
    );
    expect(dex).toBeDefined();

    // 1 unique account in dex: GB7YH (300 ops)
    expect(dex!.children?.length).toBe(1);
    expect(dex!.children![0].value).toBe(300);
  });

  it("trustlines group contains account leaves", () => {
    const root = buildActorTreemap(fullInput());
    const trustlines = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.trustlines,
    );
    expect(trustlines).toBeDefined();
    expect(trustlines!.children?.length).toBe(1);
    expect(trustlines!.children![0].value).toBe(100);
  });

  it("other group falls through to type leaves when no account aggregations", () => {
    const input = emptyInput();
    input.categories = [{ type_string: "inflation", op_count: 50 }];
    const root = buildActorTreemap(input);
    const other = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.other,
    );
    expect(other).toBeDefined();
    expect(other!.children?.length).toBe(1);
    expect(other!.children![0].meta?.eventType).toBe("inflation");
  });

  it("account group falls through to type leaves", () => {
    const input = emptyInput();
    input.categories = [{ type_string: "set_options", op_count: 30 }];
    const root = buildActorTreemap(input);
    const accountGrp = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.account,
    );
    expect(accountGrp).toBeDefined();
    expect(accountGrp!.children?.length).toBe(1);
    expect(accountGrp!.children![0].meta?.eventType).toBe("set_options");
  });

  it("accepts optional labels for display names", () => {
    const input = fullInput();
    input.labels = labels;
    const root = buildActorTreemap(input);
    const payments = (root.children ?? []).find(
      (c) => c.name === GROUP_LABELS.payments,
    );
    const anchor = payments?.children?.find((c) => c.id === "GA5XIG");
    expect(anchor).toBeDefined();
    expect(anchor!.name).toBe("Anchor 1");
  });

  it("handles empty input gracefully", () => {
    const root = buildActorTreemap(emptyInput());
    expect(root.children?.length ?? 0).toBe(0);
    expect(root.value).toBe(0);
    expect(root.meta?.type).toBe("root");
    expectParentChildIntegrity(root);
  });

  it("preserves deterministic order for equal values", () => {
    const input = emptyInput();
    input.categories = [
      { type_string: "payment", op_count: 100 },
      { type_string: "manage_buy_offer", op_count: 100 },
    ];
    const root1 = buildActorTreemap(input);
    const root2 = buildActorTreemap(input);

    const names1 = (root1.children ?? []).map((c) => c.name);
    const names2 = (root2.children ?? []).map((c) => c.name);
    expect(names1).toEqual(names2);
  });
});

// ===========================================================================
// buildAllTreemaps
// ===========================================================================
describe("buildAllTreemaps", () => {
  it("returns both treemaps", () => {
    const result = buildAllTreemaps(fullInput());
    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("actors");
  });

  it("returns separate event and actor treemaps", () => {
    const result = buildAllTreemaps(fullInput());
    expect(result.events).not.toBe(result.actors);

    const eventGroupNames = (result.events.children ?? []).map((c) => c.name);
    const actorGroupNames = (result.actors.children ?? []).map((c) => c.name);
    expect(eventGroupNames).toEqual(actorGroupNames);
  });

  it("both treemaps maintain parent-child integrity", () => {
    const result = buildAllTreemaps(fullInput());
    expectParentChildIntegrity(result.events);
    expectParentChildIntegrity(result.actors);
  });

  it("shares sum to 100% for both treemaps", () => {
    const result = buildAllTreemaps(fullInput());
    expectSharesSumTo100(result.events);
    expectSharesSumTo100(result.actors);
  });

  it("both treemaps handle empty input", () => {
    const result = buildAllTreemaps(emptyInput());
    expect(result.events.children?.length ?? 0).toBe(0);
    expect(result.actors.children?.length ?? 0).toBe(0);
  });

  it("both treemaps have same root value for identical categories", () => {
    const result = buildAllTreemaps(fullInput());
    expect(result.events.value).toBe(result.actors.value);
  });
});

// ===========================================================================
// buildKpis
// ===========================================================================
describe("buildKpis", () => {
  it("calculates totalOps correctly", () => {
    const kpis = buildKpis(mixedCategories(), mixedContracts());
    // 500 + 300 + 200 + 100 + 50 + 10 = 1160
    expect(kpis.totalOps).toBe(1160);
  });

  it("calculates sorobanShare correctly", () => {
    const kpis = buildKpis(mixedCategories(), mixedContracts());
    // soroban: 200 (invoke_host_function)
    expect(kpis.sorobanShare).toBeCloseTo((200 / 1160) * 100, 1);
  });

  it("identifies topCategory correctly", () => {
    const kpis = buildKpis(mixedCategories(), mixedContracts());
    // payments = 500, dex = 300, soroban = 200, trustlines = 100, account = 50, other = 10
    expect(kpis.topCategory).toBe(GROUP_LABELS.payments);
  });

  it("returns activeContracts count", () => {
    const kpis = buildKpis(mixedCategories(), mixedContracts());
    expect(kpis.activeContracts).toBe(2);
  });

  it("handles empty input", () => {
    const kpis = buildKpis([], []);
    expect(kpis.totalOps).toBe(0);
    expect(kpis.sorobanShare).toBe(0);
    expect(kpis.topCategory).toBe("N/A");
    expect(kpis.activeContracts).toBe(0);
  });

  it("handles single category", () => {
    const cats: CategoryRow[] = [{ type_string: "payment", op_count: 100 }];
    const kpis = buildKpis(cats, []);
    expect(kpis.totalOps).toBe(100);
    expect(kpis.sorobanShare).toBe(0);
    expect(kpis.topCategory).toBe(GROUP_LABELS.payments);
  });

  it("handles all soroban data", () => {
    const cats: CategoryRow[] = [
      { type_string: "invoke_host_function", op_count: 500 },
      { type_string: "extend_footprint_ttl", op_count: 300 },
    ];
    const kpis = buildKpis(cats, [
      { contract_id: "CA111", op_count: 500 },
    ]);
    expect(kpis.totalOps).toBe(800);
    expect(kpis.sorobanShare).toBeCloseTo(100, 1);
    expect(kpis.topCategory).toBe(GROUP_LABELS.soroban);
    expect(kpis.activeContracts).toBe(1);
  });

  it("handles zero op_count", () => {
    const cats: CategoryRow[] = [
      { type_string: "payment", op_count: 0 },
    ];
    const kpis = buildKpis(cats, []);
    expect(kpis.totalOps).toBe(0);
    expect(kpis.sorobanShare).toBe(0);
    // topCategory falls back to the group label even when value is 0
    expect(kpis.topCategory).toBe("Payments");
  });

  it("handles completely empty categories", () => {
    const kpis = buildKpis([], []);
    expect(kpis.totalOps).toBe(0);
    expect(kpis.sorobanShare).toBe(0);
    expect(kpis.topCategory).toBe("N/A");
    expect(kpis.activeContracts).toBe(0);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================
describe("treemap edge cases", () => {
  it("handles only soroban with functions and contracts", () => {
    const input = emptyInput();
    input.categories = [{ type_string: "invoke_host_function", op_count: 200 }];
    input.sorobanFunctions = [{ function_name: "swap", op_count: 200 }];
    input.sorobanFunctionContracts = [
      { function_name: "swap", contract_id: "CA111", op_count: 200 },
    ];
    input.contracts = [{ contract_id: "CA111", op_count: 200 }];

    const eventType = buildEventTypeTreemap(input);
    expectParentChildIntegrity(eventType);

    const actor = buildActorTreemap(input);
    expectParentChildIntegrity(actor);
  });

  it("handles large numbers without precision loss", () => {
    const input = emptyInput();
    input.categories = [
      { type_string: "payment", op_count: 9_007_199_254_740_991 },
    ];

    const root = buildEventTypeTreemap(input);
    expect(root.value).toBe(9_007_199_254_740_991);
    expect(root.children?.[0].value).toBe(9_007_199_254_740_991);
    expectParentChildIntegrity(root);
  });

  it("handles soroban functions without contracts", () => {
    const input = emptyInput();
    input.categories = [{ type_string: "invoke_host_function", op_count: 100 }];
    input.sorobanFunctions = [{ function_name: "swap", op_count: 100 }];
    input.sorobanFunctionContracts = [];

    const root = buildEventTypeTreemap(input);
    const soroban = root.children?.find(
      (c) => c.name === GROUP_LABELS.soroban,
    );
    const swap = soroban?.children?.find((c) => c.name === "swap");
    expect(swap?.children?.length ?? 0).toBe(0);
    expectParentChildIntegrity(root);
  });

  it("preserves deterministic ordering across calls", () => {
    const input = fullInput();
    const root1 = buildEventTypeTreemap(input);
    const root2 = buildEventTypeTreemap(input);

    const leaves1 = JSON.stringify(root1);
    const leaves2 = JSON.stringify(root2);
    expect(leaves1).toBe(leaves2);
  });
});
