import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLiquidityFlowSplit,
  buildLiquidityFlowSummary,
  classifyLiquidityFlowOpType,
  liquidityFlowSplitToCsvRows,
  serializeLiquidityFlowSplitToCsv,
  LIQUIDITY_FLOW_SPLIT_SUBTYPES,
} from "./liquidity-flow";

const FULL_FIXTURE_CATEGORIES = [
  { type_string: "manage_buy_offer", op_count: 70_000 },
  { type_string: "manage_sell_offer", op_count: 90_000 },
  { type_string: "create_passive_sell_offer", op_count: 5_000 },
  { type_string: "path_payment_strict_receive", op_count: 34_000 },
  { type_string: "path_payment_strict_send", op_count: 9_000 },
  { type_string: "liquidity_pool_deposit", op_count: 8_000 },
  { type_string: "liquidity_pool_withdraw", op_count: 6_000 },
  { type_string: "payment", op_count: 250_000 },
];

describe("classifyLiquidityFlowOpType", () => {
  it("maps manage-offer, path-payment, and related subtypes", () => {
    assert.equal(classifyLiquidityFlowOpType("manage_buy_offer"), "manage_offer");
    assert.equal(
      classifyLiquidityFlowOpType("manage_sell_offer"),
      "manage_offer",
    );
    assert.equal(
      classifyLiquidityFlowOpType("create_passive_sell_offer"),
      "manage_offer",
    );
    assert.equal(
      classifyLiquidityFlowOpType("path_payment_strict_receive"),
      "path_payment",
    );
    assert.equal(
      classifyLiquidityFlowOpType("path_payment_strict_send"),
      "path_payment",
    );
    assert.equal(
      classifyLiquidityFlowOpType("liquidity_pool_deposit"),
      "related",
    );
    assert.equal(
      classifyLiquidityFlowOpType("liquidity_pool_withdraw"),
      "related",
    );
  });

  it("returns null for types outside the liquidity-flow inclusion set", () => {
    assert.equal(classifyLiquidityFlowOpType("payment"), null);
    assert.equal(classifyLiquidityFlowOpType("invoke_host_function"), null);
    assert.equal(classifyLiquidityFlowOpType("unknown_op"), null);
  });
});

describe("buildLiquidityFlowSplit", () => {
  it("covers every split bucket when the fixture includes all subtypes", () => {
    const split = buildLiquidityFlowSplit(FULL_FIXTURE_CATEGORIES);
    assert.deepEqual(
      split.rows.map((row) => row.bucket),
      ["manage_offer", "path_payment", "related"],
    );
    assert.equal(split.missingSubtypes.length, 0);
    assert.equal(split.presentSubtypes.length, LIQUIDITY_FLOW_SPLIT_SUBTYPES.length);
    assert.equal(split.rows[0].opCount, 165_000);
    assert.equal(split.rows[1].opCount, 43_000);
    assert.equal(split.rows[2].opCount, 14_000);
    assert.equal(split.totalOpCount, 222_000);
    assert.ok(Math.abs(split.rows[0].share - 165_000 / 222_000) < 1e-12);
  });

  it("soft-fails missing subtypes to zero without dropping the bucket", () => {
    const split = buildLiquidityFlowSplit([
      { type_string: "manage_sell_offer", op_count: 10 },
      { type_string: "path_payment_strict_send", op_count: 5 },
    ]);
    assert.ok(split.missingSubtypes.includes("create_passive_sell_offer"));
    assert.ok(split.missingSubtypes.includes("liquidity_pool_deposit"));
    const manage = split.rows.find((row) => row.bucket === "manage_offer");
    const related = split.rows.find((row) => row.bucket === "related");
    assert.equal(manage?.opCount, 10);
    assert.equal(
      manage?.subtypes.find((s) => s.type === "create_passive_sell_offer")
        ?.available,
      false,
    );
    assert.equal(related?.opCount, 0);
    assert.equal(related?.share, 0);
  });

  it("ignores non-finite op counts when summing", () => {
    const split = buildLiquidityFlowSplit([
      { type_string: "manage_buy_offer", op_count: Number.NaN },
      { type_string: "manage_sell_offer", op_count: 3 },
    ]);
    assert.equal(split.rows[0].opCount, 3);
  });
});

describe("liquidity flow CSV export", () => {
  it("exports one CSV row per subtype with bucket shares", () => {
    const split = buildLiquidityFlowSplit(FULL_FIXTURE_CATEGORIES);
    const rows = liquidityFlowSplitToCsvRows(split);
    assert.equal(rows.length, LIQUIDITY_FLOW_SPLIT_SUBTYPES.length);
    assert.equal(rows[0].bucket, "manage_offer");
    assert.equal(rows[0].subtype, "manage_buy_offer");
    assert.match(rows[0].share, /^0\.\d{6}$/);

    const csv = serializeLiquidityFlowSplitToCsv(split);
    assert.match(
      csv,
      /^bucket,label,op_count,share,subtype,subtype_op_count,subtype_available\n/,
    );
    assert.match(csv, /create_passive_sell_offer,5000,true/);
  });
});

describe("buildLiquidityFlowSummary", () => {
  it("attaches the split alongside legacy count fields", () => {
    const summary = buildLiquidityFlowSummary(FULL_FIXTURE_CATEGORIES, null, null);
    assert.equal(summary.dexOperationCount, 165_000);
    assert.equal(summary.pathPaymentCount, 43_000);
    assert.equal(summary.liquidityPoolOperationCount, 14_000);
    assert.equal(summary.split.totalOpCount, 222_000);
    assert.equal(summary.intermediateAssetsAvailable, false);
  });
});
