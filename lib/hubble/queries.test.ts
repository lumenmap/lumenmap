import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { TOP_CONTRACT_LIMIT } from "@/lib/constants";
import { mapActiveContractCountRow, mapFlowEdgeRows } from "./queries";

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

describe("mapFlowEdgeRows", () => {
  test("maps valid flow edge rows", () => {
    const rows = [
      {
        source_account: "GAAA",
        destination_account: "GBBB",
        asset_key: "native:XLM",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "50000000",
        operation_count: 2,
      },
      {
        source_account: "GBBB",
        destination_account: "GCCC",
        asset_key: "issued:USDC",
        asset_code: "USDC",
        asset_issuer: "GISS",
        amount: "10000000",
        operation_count: 1,
      },
    ];

    const result = mapFlowEdgeRows(rows);
    assert.equal(result.length, 2);
    assert.equal(result[0].source_account, "GAAA");
    assert.equal(result[0].asset_key, "native:XLM");
    assert.equal(result[0].amount, "50000000");
    assert.equal(result[1].asset_code, "USDC");
  });

  test("handles missing or null fields gracefully", () => {
    const rows = [
      {
        source_account: "GAAA",
        destination_account: "GBBB",
        asset_key: "native:XLM",
        asset_code: "XLM",
        asset_issuer: null,
        amount: null,
        operation_count: 0,
      },
    ];

    const result = mapFlowEdgeRows(rows);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, "0");
    assert.equal(result[0].operation_count, 0);
  });

  test("ensures each edge has a single asset mode", () => {
    const rows = [
      {
        source_account: "GAAA",
        destination_account: "GBBB",
        asset_key: "native:XLM",
        asset_code: "XLM",
        asset_issuer: null,
        amount: "50000000",
        operation_count: 2,
      },
    ];

    const result = mapFlowEdgeRows(rows);
    assert.equal(result[0].asset_key, "native:XLM");
    assert.equal(result[0].asset_code, "XLM");
    assert.equal(result[0].asset_issuer, null);
    // Verify no mixed assets - each edge has exactly one asset identity
    assert.ok(result[0].asset_key.includes(":"));
  });
});
