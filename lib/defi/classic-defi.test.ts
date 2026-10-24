import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLAIMABLE_BALANCE_OP_TYPES,
  LIQUIDITY_POOL_OP_TYPES,
  TYPE_TO_GROUP,
  getCategoryForOperation,
} from "@/lib/constants";
import {
  buildClassicDefiBreakdown,
  buildClassicDefiBreakdowns,
} from "@/lib/defi/classic-defi";
import { getFixtureActivityData } from "@/lib/fixtures/activity";
import { getFixtureCategoryShareSeries } from "@/lib/charts/category-share-fixture";
import type { AccountRow } from "@/lib/types";

const rows: AccountRow[] = [
  { account_id: "GA_DEPOSITOR", type_string: "liquidity_pool_deposit", op_count: 60 },
  { account_id: "GA_DEPOSITOR", type_string: "liquidity_pool_withdraw", op_count: 40 },
  { account_id: "GA_WITHDRAWER", type_string: "liquidity_pool_withdraw", op_count: 90 },
  { account_id: "GA_TRADER", type_string: "manage_sell_offer", op_count: 500 },
  { account_id: "GA_CLAIMER", type_string: "claim_claimable_balance", op_count: 25 },
  { account_id: "GA_CREATOR", type_string: "create_claimable_balance", op_count: 30 },
  { account_id: "GA_CREATOR", type_string: "clawback_claimable_balance", op_count: 5 },
  { account_id: "GA_ZERO", type_string: "liquidity_pool_deposit", op_count: 0 },
];

describe("classic DeFi category mapping", () => {
  it("moves liquidity-pool operations out of the DEX group", () => {
    assert.deepEqual([...LIQUIDITY_POOL_OP_TYPES].sort(), [
      "liquidity_pool_deposit",
      "liquidity_pool_withdraw",
    ]);
    for (const type of LIQUIDITY_POOL_OP_TYPES) {
      assert.equal(getCategoryForOperation(type), "liquidity_pools");
      assert.equal(TYPE_TO_GROUP[type], "liquidity_pools");
    }
  });

  it("moves claimable-balance operations out of the account group", () => {
    assert.deepEqual([...CLAIMABLE_BALANCE_OP_TYPES].sort(), [
      "claim_claimable_balance",
      "clawback_claimable_balance",
      "create_claimable_balance",
    ]);
    for (const type of CLAIMABLE_BALANCE_OP_TYPES) {
      assert.equal(getCategoryForOperation(type), "claimable_balances");
    }
  });

  it("keeps DEX trades and non-claimable account operations in their groups", () => {
    assert.equal(getCategoryForOperation("manage_sell_offer"), "dex");
    assert.equal(getCategoryForOperation("create_passive_sell_offer"), "dex");
    assert.equal(getCategoryForOperation("clawback"), "account");
    assert.equal(getCategoryForOperation("revoke_sponsorship"), "account");
  });
});

describe("buildClassicDefiBreakdown", () => {
  it("ranks accounts across every operation type of the scope", () => {
    const breakdown = buildClassicDefiBreakdown(rows, "liquidity_pools");
    assert.equal(breakdown.totalOps, 190);
    assert.deepEqual(
      breakdown.rows.map((row) => [row.accountId, row.ops]),
      [
        ["GA_DEPOSITOR", 100],
        ["GA_WITHDRAWER", 90],
      ],
    );
    assert.deepEqual(breakdown.rows[0].byType, [
      { type_string: "liquidity_pool_deposit", ops: 60 },
      { type_string: "liquidity_pool_withdraw", ops: 40 },
    ]);
  });

  it("reports scope share and leaves unrelated operation types out", () => {
    const breakdown = buildClassicDefiBreakdown(rows, "liquidity_pools");
    assert.ok(Math.abs(breakdown.rows[0].scopeShare - (100 / 190) * 100) < 1e-9);
    assert.equal(
      breakdown.rows.some((row) => row.accountId === "GA_TRADER"),
      false,
    );
    assert.equal(
      breakdown.rows.some((row) => row.accountId === "GA_ZERO"),
      false,
    );
  });

  it("splits claimable-balance work per account", () => {
    const breakdown = buildClassicDefiBreakdown(rows, "claimable_balances");
    assert.equal(breakdown.totalOps, 60);
    assert.equal(breakdown.rows[0].accountId, "GA_CREATOR");
    assert.equal(breakdown.rows[0].ops, 35);
    assert.deepEqual(breakdown.rows[0].byType, [
      { type_string: "create_claimable_balance", ops: 30 },
      { type_string: "clawback_claimable_balance", ops: 5 },
    ]);
  });

  it("caps the ranking and flags truncation", () => {
    const many: AccountRow[] = LIQUIDITY_POOL_OP_TYPES.flatMap(
      (type_string, typeIndex) =>
        Array.from({ length: 12 }, (_, index) => ({
          account_id: `GA_${String(typeIndex + index).padStart(3, "0")}`,
          type_string,
          op_count: 10 + index,
        })),
    );
    const breakdown = buildClassicDefiBreakdown(many, "liquidity_pools", 5);
    assert.equal(breakdown.rows.length, 5);
    assert.equal(breakdown.truncated, true);
    assert.ok(breakdown.distinctAccounts > 5);
  });

  it("returns an empty breakdown when the scope has no activity", () => {
    const breakdown = buildClassicDefiBreakdown(
      [{ account_id: "GA_TRADER", type_string: "manage_buy_offer", op_count: 3 }],
      "claimable_balances",
    );
    assert.equal(breakdown.totalOps, 0);
    assert.deepEqual(breakdown.rows, []);
    assert.equal(breakdown.truncated, false);
  });
});

describe("buildClassicDefiBreakdowns", () => {
  it("returns both scopes in one pass", () => {
    const both = buildClassicDefiBreakdowns(rows);
    assert.equal(both.liquidityPools.totalOps, 190);
    assert.equal(both.claimableBalances.totalOps, 60);
  });
});

describe("fixture mode", () => {
  it("shows a non-zero liquidity-pool and claimable-balance slice in the treemap", () => {
    const data = getFixtureActivityData("1d");
    const categoryNodes = data.treemaps.events.children ?? [];
    const lp = categoryNodes.find(
      (node) => node.meta?.category === "liquidity_pools",
    );
    const claimable = categoryNodes.find(
      (node) => node.meta?.category === "claimable_balances",
    );

    assert.ok(lp, "fixture treemap has no liquidity-pool category");
    assert.ok(claimable, "fixture treemap has no claimable-balance category");
    assert.ok((lp?.meta?.share ?? 0) > 0);
    assert.ok((claimable?.meta?.share ?? 0) > 0);
    assert.equal(lp?.name, "Liquidity Pools");
    assert.equal(claimable?.name, "Claimable Balances");
  });

  it("feeds the ranked tables from fixture account rows", () => {
    const data = getFixtureActivityData("1d");
    const both = buildClassicDefiBreakdowns(data.accounts);
    assert.ok(both.liquidityPools.rows.length > 0);
    assert.ok(both.claimableBalances.rows.length > 0);
    assert.equal(
      both.liquidityPools.rows[0].accountId,
      "GDKJ3ZXB5RA2MV5T2Y3Z5D3D3VKR5F7EFRB2A3BMBC3IHGBOK5GDI2LQ",
    );
  });

  it("splits the fixture category-share rows across the new categories", () => {
    const series = getFixtureCategoryShareSeries(
      "1d",
      new Date("2026-07-28T15:30:00.000Z"),
    );
    const totals = series.buckets.reduce(
      (acc, bucket) => ({
        liquidityPools: acc.liquidityPools + bucket.categories.liquidity_pools,
        claimableBalances:
          acc.claimableBalances + bucket.categories.claimable_balances,
      }),
      { liquidityPools: 0, claimableBalances: 0 },
    );
    assert.ok(totals.liquidityPools > 0);
    assert.ok(totals.claimableBalances > 0);
    assert.ok(
      series.legend.some((item) => item.id === "liquidity_pools"),
      "category-share legend omits the liquidity-pool category",
    );
  });
});
