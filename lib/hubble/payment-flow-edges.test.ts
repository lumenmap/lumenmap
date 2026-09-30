import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapPaymentFlowEdgesRows } from "./queries";
import {
  paymentFlowEdgesQuery,
  queryRegistry,
  TOP_PAYMENT_FLOW_EDGES,
} from "./shared-queries.mjs";

const GA = `G${"A".repeat(55)}`;
const GB = `G${"B".repeat(55)}`;
const GC = `G${"C".repeat(55)}`;
const GD = `G${"D".repeat(55)}`;

describe("mapPaymentFlowEdgesRows", () => {
  it("keeps same-code assets with different issuers distinct", () => {
    const rows = mapPaymentFlowEdgesRows([
      {
        from_account: GA,
        to_account: GB,
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "12.5",
        op_count: 2,
      },
      {
        from_account: GA,
        to_account: GB,
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: GC,
        amount: "5",
        op_count: 1,
      },
      {
        from_account: GA,
        to_account: GB,
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: GD,
        amount: "7",
        op_count: 3,
      },
    ]);

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.asset),
      [
        { type: "native", code: "XLM" },
        { type: "issued", code: "USDC", issuer: GC },
        { type: "issued", code: "USDC", issuer: GD },
      ],
    );
  });

  it("preserves input order so SQL sort stays deterministic", () => {
    const rows = mapPaymentFlowEdgesRows([
      {
        from_account: GA,
        to_account: GB,
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "30",
        op_count: 9,
      },
      {
        from_account: GC,
        to_account: GD,
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "10",
        op_count: 4,
      },
    ]);

    assert.deepEqual(
      rows.map((row) => [row.from, row.to]),
      [
        [GA, GB],
        [GC, GD],
      ],
    );
  });

  it("drops malformed rows without throwing on the whole batch", () => {
    const rows = mapPaymentFlowEdgesRows([
      {
        from_account: GA,
        to_account: GB,
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "3",
        op_count: 1,
      },
      { from_account: null, to_account: GB, asset_type: "native", amount: "1", op_count: 1 },
      { from_account: GA, to_account: "", asset_type: "native", amount: "1", op_count: 1 },
      { from_account: "M123", to_account: GB, asset_type: "native", amount: "1", op_count: 1 },
      { from_account: GA, to_account: GA, asset_type: "native", amount: "1", op_count: 1 },
      { from_account: GA, to_account: GB, asset_type: "native", amount: "NaN", op_count: 1 },
      { from_account: GA, to_account: GB, asset_type: "native", amount: "-4", op_count: 1 },
      {
        from_account: GA,
        to_account: GB,
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: null,
        amount: "2",
        op_count: 1,
      },
      {
        from_account: GA,
        to_account: GB,
        asset_type: "credit_alphanum4",
        asset_code: "",
        asset_issuer: GC,
        amount: "2",
        op_count: 1,
      },
      {
        from_account: GA,
        to_account: GB,
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "2",
        op_count: 0,
      },
    ]);

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      from: GA,
      to: GB,
      asset: { type: "native", code: "XLM" },
      amount: "3",
      opCount: 1,
    });
  });

  it("keeps zero-amount drain edges", () => {
    const rows = mapPaymentFlowEdgesRows([
      {
        from_account: GA,
        to_account: GB,
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "0",
        op_count: 1,
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, "0");
  });
});

describe("paymentFlowEdgesQuery", () => {
  it("uses a top-N limit of 200", () => {
    assert.equal(TOP_PAYMENT_FLOW_EDGES, 200);
    assert.match(paymentFlowEdgesQuery, /LIMIT 200/);
  });

  it("sorts by op_count then amount with deterministic tiebreakers", () => {
    assert.match(
      paymentFlowEdgesQuery,
      /ORDER BY op_count DESC, total_amount DESC/,
    );
  });

  it("is parameterized on the half-open period", () => {
    assert.match(paymentFlowEdgesQuery, /@start <= closed_at AND closed_at < @end/);
  });

  it("covers destination legs, funding balances, and merge drains", () => {
    assert.match(paymentFlowEdgesQuery, /details\.to/);
    assert.match(paymentFlowEdgesQuery, /details\.new_account/);
    assert.match(paymentFlowEdgesQuery, /details\.into/);
    assert.match(paymentFlowEdgesQuery, /details\.starting_balance/);
    assert.match(paymentFlowEdgesQuery, /COALESCE\(dest_amount, amount\)/);
  });

  it("is registered with start/end params", () => {
    const entry = queryRegistry.find(
      (item) => item.name === "paymentFlowEdgesQuery",
    );
    assert.deepEqual(entry?.requiredParams, ["start", "end"]);
  });
});
