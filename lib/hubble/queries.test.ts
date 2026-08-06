import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { TOP_CONTRACT_LIMIT } from "@/lib/constants";
import { mapActiveContractCountRow } from "./queries";

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
