import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXTURE_ACCOUNTS } from "@/lib/fixtures/raw-data";
import {
  OVERLAPPING_COUNTERPARTY_FIXTURE_EDGES,
  TOP_COUNTERPARTIES_LIMIT,
  rankTopCounterparties,
  type CounterpartyEdgeInput,
} from "@/lib/entities/top-counterparties";

function edge(
  source: string,
  destination: string,
  operationCount: number,
  overrides: Partial<CounterpartyEdgeInput> = {},
): CounterpartyEdgeInput {
  return {
    source,
    destination,
    assetKey: "native:XLM",
    amount: "100",
    amountComplete: true,
    operationCount,
    ...overrides,
  };
}

describe("rankTopCounterparties", () => {
  it("merges overlapping multi-asset edges and ranks by op count", () => {
    const result = rankTopCounterparties(
      FIXTURE_ACCOUNTS.kraken,
      OVERLAPPING_COUNTERPARTY_FIXTURE_EDGES,
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      [FIXTURE_ACCOUNTS.lobstr, FIXTURE_ACCOUNTS.moneygram],
    );
    assert.equal(result.rows[0]?.operationCount, 8);
    assert.equal(result.rows[0]?.outflowOps, 8);
    assert.equal(result.rows[0]?.inflowOps, 0);
    // Multi-asset overlap → volume omitted (cross-asset sums are out of scope).
    assert.equal(result.rows[0]?.volume, undefined);

    assert.equal(result.rows[1]?.operationCount, 2);
    assert.equal(result.rows[1]?.inflowOps, 2);
    assert.equal(result.rows[1]?.volume?.assetCode, "XLM");
    assert.equal(result.rows[1]?.volume?.amount, "80000000");
    assert.equal(result.totalCount, 2);
    assert.equal(result.hasMore, false);
  });

  it("ignores self-edges and edges that do not touch the center", () => {
    const result = rankTopCounterparties(FIXTURE_ACCOUNTS.kraken, [
      edge(FIXTURE_ACCOUNTS.kraken, FIXTURE_ACCOUNTS.kraken, 9),
      edge(FIXTURE_ACCOUNTS.lobstr, FIXTURE_ACCOUNTS.unknownA, 4),
      edge(FIXTURE_ACCOUNTS.kraken, FIXTURE_ACCOUNTS.moneygram, 1),
    ]);

    assert.deepEqual(
      result.rows.map((row) => row.id),
      [FIXTURE_ACCOUNTS.moneygram],
    );
  });

  it("omits volume when any edge amount is incomplete", () => {
    const result = rankTopCounterparties(FIXTURE_ACCOUNTS.kraken, [
      edge(FIXTURE_ACCOUNTS.kraken, FIXTURE_ACCOUNTS.lobstr, 2, {
        amountComplete: false,
      }),
    ]);

    assert.equal(result.rows[0]?.operationCount, 2);
    assert.equal(result.rows[0]?.volume, undefined);
  });

  it("caps at documented N and reports a more note", () => {
    const edges: CounterpartyEdgeInput[] = [];
    for (let i = 0; i < TOP_COUNTERPARTIES_LIMIT + 3; i += 1) {
      const destination = `G${String(i).padStart(55, "A")}`;
      edges.push(edge(FIXTURE_ACCOUNTS.kraken, destination, TOP_COUNTERPARTIES_LIMIT + 3 - i));
    }

    const result = rankTopCounterparties(FIXTURE_ACCOUNTS.kraken, edges);

    assert.equal(result.configuredLimit, TOP_COUNTERPARTIES_LIMIT);
    assert.equal(result.rows.length, TOP_COUNTERPARTIES_LIMIT);
    assert.equal(result.totalCount, TOP_COUNTERPARTIES_LIMIT + 3);
    assert.equal(result.hasMore, true);
    assert.equal(result.moreCount, 3);
  });

  it("treats malformed amounts as zero without throwing", () => {
    const result = rankTopCounterparties(FIXTURE_ACCOUNTS.kraken, [
      edge(FIXTURE_ACCOUNTS.kraken, FIXTURE_ACCOUNTS.lobstr, 1, {
        amount: "not-a-number",
      }),
    ]);

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.volume?.amount, "0");
  });

  it("uses node labels when provided", () => {
    const result = rankTopCounterparties(
      FIXTURE_ACCOUNTS.kraken,
      [edge(FIXTURE_ACCOUNTS.kraken, FIXTURE_ACCOUNTS.lobstr, 1)],
      {
        nodes: [{ id: FIXTURE_ACCOUNTS.lobstr, label: "Lobstr Wallet", category: "wallet" }],
      },
    );

    assert.equal(result.rows[0]?.label, "Lobstr Wallet");
    assert.equal(result.rows[0]?.category, "wallet");
  });
});
