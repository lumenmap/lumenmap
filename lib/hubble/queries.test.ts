import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { TOP_CONTRACT_LIMIT } from "@/lib/constants";
import {
  mapAccountCounterpartyRows,
  mapActiveContractCountRow,
  mapPathPaymentAmountsRows,
  mapPathPaymentIntermediateRows,
} from "./queries";

describe("path-payment mappers", () => {
  test("maps asset-denominated XLM and USDC notionals", () => {
    assert.deepEqual(
      mapPathPaymentAmountsRows(
        [{ xlm_amount: "123.456" }],
        [{ usdc_amount: "789.01" }],
      ),
      { xlmAmount: "123.456", usdcAmount: "789.01" },
    );
    assert.deepEqual(mapPathPaymentAmountsRows([{ xlm_amount: "0" }], []), {
      xlmAmount: "0",
      usdcAmount: null,
    });
  });

  test("marks missing or malformed amount values unavailable", () => {
    assert.deepEqual(
      mapPathPaymentAmountsRows(
        [{ xlm_amount: "-1" }],
        [{ usdc_amount: "Infinity" }],
      ),
      { xlmAmount: null, usdcAmount: null },
    );
    assert.deepEqual(mapPathPaymentAmountsRows([{ xlm_amount: true }], []), {
      xlmAmount: null,
      usdcAmount: null,
    });
    assert.equal(mapPathPaymentAmountsRows([], []), null);
  });

  test("maps and validates ranked intermediate-asset rows", () => {
    assert.deepEqual(
      mapPathPaymentIntermediateRows([
        {
          asset_code: "USDC",
          asset_issuer: "GISSUER",
          route_appearances: "8",
        },
        { asset_code: "XLM", asset_issuer: null, route_appearances: 3 },
        { asset_code: "", asset_issuer: null, route_appearances: 20 },
        { asset_code: "AQUA", asset_issuer: "GISSUER", route_appearances: -1 },
      ]),
      {
        assets: [
          { code: "USDC", issuer: "GISSUER", routeAppearances: 8 },
          { code: "XLM", routeAppearances: 3 },
        ],
        available: true,
      },
    );
    assert.deepEqual(mapPathPaymentIntermediateRows([]), null);
  });
});

describe("mapActiveContractCountRow", () => {
  test("counts each duplicate contract ID once", () => {
    const rows = [
      { contract_id: "CONTRACT_A" },
      { contract_id: "CONTRACT_B" },
      { contract_id: "CONTRACT_A" },
    ];

    assert.deepEqual(mapActiveContractCountRow(rows), {
      active_contract_count: 2,
    });
  });

  test("excludes null, undefined, and empty contract IDs", () => {
    const rows = [
      { contract_id: "CONTRACT_A" },
      { contract_id: null },
      { contract_id: undefined },
      { contract_id: "" },
      { contract_id: "CONTRACT_B" },
    ];

    assert.deepEqual(mapActiveContractCountRow(rows), {
      active_contract_count: 2,
    });
  });

  test("returns zero for an empty period", () => {
    assert.deepEqual(mapActiveContractCountRow([]), {
      active_contract_count: 0,
    });
  });

  test("can exceed TOP_CONTRACT_LIMIT, unlike the capped leaderboard", () => {
    const contractCount = TOP_CONTRACT_LIMIT + 50;
    const rows = Array.from({ length: contractCount }, (_, i) => ({
      contract_id: `CONTRACT_${i}`,
    }));

    assert.deepEqual(mapActiveContractCountRow(rows), {
      active_contract_count: contractCount,
    });
  });
});

describe("mapAccountCounterpartyRows", () => {
  test("maps inbound and outbound rows with stable ordering and aliases", () => {
    const gbbb = `G${"B".repeat(55)}`;
    const gaaa = `G${"A".repeat(55)}`;
    const gccc = `G${"C".repeat(55)}`;
    const rows = [
      {
        counterparty: gbbb,
        direction: "out",
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "15.5",
        op_count: 3,
      },
      {
        counterparty_account: gaaa,
        direction: "in",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GISSUER",
        amount: "27.25",
        op_count: 5,
      },
      {
        counterparty: gccc,
        direction: "out",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GISSUER",
        amount: "27.25",
        op_count: 5,
      },
    ];

    const mapped = mapAccountCounterpartyRows(rows);

    assert.deepEqual(
      mapped.map(({ counterparty, direction, amount, op_count }) => ({
        counterparty,
        direction,
        amount,
        op_count,
      })),
      [
        { counterparty: gaaa, direction: "in", amount: "27.25", op_count: 5 },
        { counterparty: gccc, direction: "out", amount: "27.25", op_count: 5 },
        { counterparty: gbbb, direction: "out", amount: "15.5", op_count: 3 },
      ],
    );

    assert.equal(mapped[0].counterparty_account, gaaa);
    assert.deepEqual(mapped[0].asset, {
      type: "issued",
      code: "USDC",
      issuer: "GISSUER",
    });
  });

  test("omits invalid or empty counterparties and leaves self-payments to the caller", () => {
    const gaaa = `G${"A".repeat(55)}`;
    const gccc = `G${"C".repeat(55)}`;
    const rows = [
      { counterparty: gaaa, direction: "in", asset_type: "native", amount: "10", op_count: 1 },
      { counterparty: "", direction: "out", asset_type: "native", amount: "2", op_count: 2 },
      { counterparty: "MALFORMED", direction: "out", asset_type: "native", amount: "3", op_count: 3 },
      { counterparty: gccc, direction: "in", asset_type: "native", amount: "4", op_count: 4 },
    ];

    assert.deepEqual(
      mapAccountCounterpartyRows(rows).map(({ counterparty }) => counterparty),
      [gccc, gaaa],
    );
  });
});
