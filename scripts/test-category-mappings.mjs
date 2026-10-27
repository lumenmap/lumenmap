#!/usr/bin/env node

import assert from "node:assert";

// Import constants directly from lib/constants.ts via ESM / standard object extraction
import {
  CATEGORY_COLORS,
  CATEGORY_PATTERNS,
  CLAIMABLE_BALANCE_OP_TYPES,
  GROUP_LABELS,
  LIQUIDITY_POOL_OP_TYPES,
  TYPE_TO_GROUP,
  getCategoryForOperation,
} from "../lib/constants.ts";
import { CATEGORY_IDS } from "../lib/charts/category-share.ts";
import { getCategoryPatternId } from "../lib/treemap-patterns.ts";
import { ACCOUNT_QUERY_TYPES } from "../lib/hubble/shared-queries.mjs";

console.log("Running operation-to-category mapping unit tests...\n");

/**
 * Easily maintainable fixture table mapping every known Stellar operation to its expected category.
 */
const EXPECTED_OPERATION_CATEGORIES = {
  // Soroban Operations
  invoke_host_function: "soroban",
  extend_footprint_ttl: "soroban",
  restore_footprint: "soroban",

  // Payment Operations
  payment: "payments",
  path_payment_strict_receive: "payments",
  path_payment_strict_send: "payments",
  create_account: "payments",
  account_merge: "payments",

  // DEX Operations
  manage_buy_offer: "dex",
  manage_sell_offer: "dex",
  create_passive_sell_offer: "dex",

  // Liquidity Pool Operations (classic AMM pools)
  liquidity_pool_deposit: "liquidity_pools",
  liquidity_pool_withdraw: "liquidity_pools",

  // Claimable Balance Operations (classic claimable balances)
  create_claimable_balance: "claimable_balances",
  claim_claimable_balance: "claimable_balances",
  clawback_claimable_balance: "claimable_balances",

  // Trustline Operations
  change_trust: "trustlines",

  // Account & Sponsorship Operations
  set_options: "account",
  bump_sequence: "account",
  allow_trust: "account",
  manage_data: "account",
  begin_sponsoring_future_reserves: "account",
  end_sponsoring_future_reserves: "account",
  revoke_sponsorship: "account",
  clawback: "account",
  set_trust_line_flags: "account",

  // Other Operations
  inflation: "other",
};

let passed = 0;
let total = 0;

function runTest(description, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${description}`);
  } catch (error) {
    console.error(`  ✕ ${description}`);
    console.error(`    ${error.message}`);
    process.exitCode = 1;
  }
}

// Test 1: Every declared operation in TYPE_TO_GROUP maps to its expected fixture category
runTest("Every declared operation maps to its exact expected category", () => {
  for (const [opType, expectedCategory] of Object.entries(EXPECTED_OPERATION_CATEGORIES)) {
    const actualCategory = getCategoryForOperation(opType);
    assert.strictEqual(
      actualCategory,
      expectedCategory,
      `Operation '${opType}' mapped to '${actualCategory}', expected '${expectedCategory}'`,
    );
  }
});

// Test 2: Every key in TYPE_TO_GROUP is present in the expected fixture table (detect unexpected new additions)
runTest("All keys in TYPE_TO_GROUP are accounted for in EXPECTED_OPERATION_CATEGORIES fixture", () => {
  for (const opType of Object.keys(TYPE_TO_GROUP)) {
    assert.ok(
      opType in EXPECTED_OPERATION_CATEGORIES,
      `Operation '${opType}' in TYPE_TO_GROUP is not present in EXPECTED_OPERATION_CATEGORIES fixture`,
    );
  }
});

// Test 3: Unknown operation fallback to "other"
runTest("Unknown operation types fall back to 'other'", () => {
  const unknownOps = [
    "unknown_operation_xyz",
    "soroban_future_op",
    "",
    "12345",
    "CUSTOM_OP_TYPE",
  ];

  for (const op of unknownOps) {
    const category = getCategoryForOperation(op);
    assert.strictEqual(
      category,
      "other",
      `Unknown operation '${op}' mapped to '${category}' instead of 'other'`,
    );
  }
});

// Test 4: Every referenced category in TYPE_TO_GROUP has valid display metadata (label & color)
runTest("Every category referenced in TYPE_TO_GROUP has valid label in GROUP_LABELS and color in CATEGORY_COLORS", () => {
  const categoriesInUse = new Set(Object.values(TYPE_TO_GROUP));
  // Add fallback category
  categoriesInUse.add("other");

  for (const cat of categoriesInUse) {
    assert.ok(
      cat in GROUP_LABELS,
      `Category '${cat}' is used in TYPE_TO_GROUP but missing a display label in GROUP_LABELS`,
    );
    assert.ok(
      typeof GROUP_LABELS[cat] === "string" && GROUP_LABELS[cat].trim().length > 0,
      `Category '${cat}' has empty or invalid label in GROUP_LABELS`,
    );
    assert.ok(
      cat in CATEGORY_COLORS,
      `Category '${cat}' is used in TYPE_TO_GROUP but missing a color in CATEGORY_COLORS`,
    );
    assert.ok(
      typeof CATEGORY_COLORS[cat] === "string" &&
        (CATEGORY_COLORS[cat].startsWith("#") ||
          CATEGORY_COLORS[cat].startsWith("var(--")),
      `Category '${cat}' has invalid color format in CATEGORY_COLORS: '${CATEGORY_COLORS[cat]}'`,
    );
  }
});

// Test 5: Check for unused or orphaned categories in CATEGORY_COLORS / GROUP_LABELS
runTest("CATEGORY_COLORS and GROUP_LABELS keys are in 1-to-1 sync", () => {
  const colorKeys = Object.keys(CATEGORY_COLORS).sort();
  const labelKeys = Object.keys(GROUP_LABELS).sort();
  assert.deepStrictEqual(
    colorKeys,
    labelKeys,
    `CATEGORY_COLORS keys (${colorKeys.join(", ")}) do not match GROUP_LABELS keys (${labelKeys.join(", ")})`,
  );
});

// Test 6: The chart's category ids are the same set the mapping can produce,
// so a new category is never silently folded into Other in category share.
runTest("Every mapped category is a chart category id", () => {
  const chartIds = new Set(CATEGORY_IDS);
  for (const cat of new Set(Object.values(TYPE_TO_GROUP))) {
    assert.ok(
      chartIds.has(cat),
      `Category '${cat}' is produced by TYPE_TO_GROUP but is missing from CATEGORY_IDS`,
    );
  }
  assert.deepStrictEqual(
    [...CATEGORY_IDS].sort(),
    Object.keys(CATEGORY_COLORS).sort(),
    `CATEGORY_IDS and CATEGORY_COLORS cover different categories`,
  );
});

// Test 7: Every category has a treemap pattern cue and that cue is rendered.
runTest("Every category has a resolvable treemap pattern", () => {
  for (const cat of Object.keys(CATEGORY_COLORS)) {
    assert.ok(cat in CATEGORY_PATTERNS, `Category '${cat}' has no pattern variant`);
    const variant = CATEGORY_PATTERNS[cat];
    if (variant === "none") continue;
    assert.ok(
      getCategoryPatternId(cat),
      `Category '${cat}' pattern '${variant}' has no SVG pattern definition`,
    );
  }
});

// Test 8: The classic DeFi groups are non-empty and ranked from queried accounts.
runTest("Liquidity-pool and claimable-balance types are ranked from Hubble accounts", () => {
  assert.ok(LIQUIDITY_POOL_OP_TYPES.length > 0, "No liquidity-pool operation types");
  assert.ok(CLAIMABLE_BALANCE_OP_TYPES.length > 0, "No claimable-balance operation types");

  const queried = new Set(ACCOUNT_QUERY_TYPES);
  for (const type of [...LIQUIDITY_POOL_OP_TYPES, ...CLAIMABLE_BALANCE_OP_TYPES]) {
    assert.ok(
      queried.has(type),
      `Operation type '${type}' is not in ACCOUNT_QUERY_TYPES, so the ranked table has no live rows`,
    );
  }
});

console.log(`\nTest Results: ${passed}/${total} passed.`);

if (passed !== total) {
  process.exit(1);
}
