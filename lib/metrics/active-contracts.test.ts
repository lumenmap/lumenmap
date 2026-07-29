import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TOP_CONTRACT_LIMIT } from "@/lib/constants";
import { buildKpis } from "@/lib/entities/build-treemap";
import { buildActivityResponse } from "@/lib/hubble/activity";
import {
  activeContractCountQuery,
  contractQuery,
  mapActiveContractCountRows,
  type RawQueryResults,
} from "@/lib/hubble/queries";
import type { CategoryRow, ContractRow } from "@/lib/types";

function makeContract(index: number): ContractRow {
  return {
    contract_id: `C${String(index).padStart(55, "0")}`,
    op_count: Math.max(1, 1000 - index),
  };
}

function makeCategories(): CategoryRow[] {
  return [
    { type_string: "invoke_host_function", op_count: 500 },
    { type_string: "payment", op_count: 100 },
  ];
}

function makeRaw(
  contracts: ContractRow[],
  activeContractCount: number,
): RawQueryResults {
  return {
    categories: makeCategories(),
    contracts,
    activeContractCount,
    accounts: [],
    sorobanFunctions: [],
    sorobanFunctionContracts: [],
  };
}

describe("mapActiveContractCountRows", () => {
  it("returns zero for an empty result", () => {
    assert.equal(mapActiveContractCountRows([]), 0);
  });

  it("returns zero when the aggregate field is missing or null", () => {
    assert.equal(mapActiveContractCountRows([{}]), 0);
    assert.equal(mapActiveContractCountRows([{ active_contract_count: null }]), 0);
    assert.equal(mapActiveContractCountRows([{ active_contract_count: "" }]), 0);
  });

  it("maps a finite aggregate value", () => {
    assert.equal(
      mapActiveContractCountRows([{ active_contract_count: 247 }]),
      247,
    );
    assert.equal(
      mapActiveContractCountRows([{ active_contract_count: "312" }]),
      312,
    );
  });
});

describe("activeContractCountQuery", () => {
  it("has no leaderboard LIMIT and uses distinct contract_id", () => {
    assert.match(activeContractCountQuery, /COUNT\s*\(\s*DISTINCT\s+contract_id\s*\)/i);
    assert.doesNotMatch(activeContractCountQuery, /\bLIMIT\b/i);
    assert.match(contractQuery, new RegExp(`LIMIT\\s+${TOP_CONTRACT_LIMIT}`));
  });
});

describe("buildKpis activeContracts", () => {
  it("uses the uncapped aggregate, not contracts.length", () => {
    const contracts = Array.from({ length: TOP_CONTRACT_LIMIT }, (_, i) =>
      makeContract(i),
    );
    const kpis = buildKpis(makeCategories(), 350);

    assert.equal(contracts.length, TOP_CONTRACT_LIMIT);
    assert.equal(kpis.activeContracts, 350);
    assert.notEqual(kpis.activeContracts, contracts.length);
  });

  it("reports zero when no qualifying contracts exist", () => {
    const kpis = buildKpis(makeCategories(), 0);
    assert.equal(kpis.activeContracts, 0);
  });

  it("matches the aggregate below, at, and above the leaderboard limit", () => {
    for (const count of [0, 50, TOP_CONTRACT_LIMIT, TOP_CONTRACT_LIMIT + 40]) {
      const leaderboard = Array.from(
        { length: Math.min(count, TOP_CONTRACT_LIMIT) },
        (_, i) => makeContract(i),
      );
      const kpis = buildKpis(makeCategories(), count);

      assert.equal(kpis.activeContracts, count);
      assert.ok(leaderboard.length <= TOP_CONTRACT_LIMIT);
      if (count > TOP_CONTRACT_LIMIT) {
        assert.equal(leaderboard.length, TOP_CONTRACT_LIMIT);
        assert.ok(kpis.activeContracts > leaderboard.length);
      }
    }
  });
});

describe("buildActivityResponse", () => {
  it("keeps capped contracts while KPI and aggregate use the uncapped count", () => {
    const contracts = Array.from({ length: TOP_CONTRACT_LIMIT }, (_, i) =>
      makeContract(i),
    );
    const uncapped = TOP_CONTRACT_LIMIT + 87;
    const response = buildActivityResponse(
      "1d",
      "2026-07-28T00:00:00.000Z",
      "2026-07-28T23:59:59.999Z",
      makeRaw(contracts, uncapped),
    );

    assert.equal(response.contracts.length, TOP_CONTRACT_LIMIT);
    assert.equal(response.activeContractCount, uncapped);
    assert.equal(response.kpis.activeContracts, uncapped);
    assert.notEqual(response.kpis.activeContracts, response.contracts.length);
    assert.equal(
      response.provenance.activeContracts.aggregation,
      "uncapped_distinct_count",
    );
    assert.equal(
      response.provenance.activeContracts.query,
      "activeContractCountQuery",
    );
    assert.equal(
      response.provenance.activeContracts.leaderboardLimit,
      TOP_CONTRACT_LIMIT,
    );
  });

  it("produces a zero KPI and aggregate for an empty period", () => {
    const response = buildActivityResponse(
      "1d",
      "2026-07-28T00:00:00.000Z",
      "2026-07-28T23:59:59.999Z",
      makeRaw([], 0),
    );

    assert.equal(response.contracts.length, 0);
    assert.equal(response.activeContractCount, 0);
    assert.equal(response.kpis.activeContracts, 0);
  });
});
