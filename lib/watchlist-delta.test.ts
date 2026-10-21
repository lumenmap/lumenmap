import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIXTURE_ACCOUNTS,
  FIXTURE_CONTRACTS,
  getFixtureRawActivity,
} from "@/lib/fixtures/raw-data";
import { getFixtureTimeseries } from "@/lib/fixtures/timeseries";
import {
  activityDeltaPercent,
  fixtureWatchlistDelta,
  formatActivityDelta,
  previousEqualAnchor,
  scalePreviousOps,
  sumBucketOperations,
} from "./watchlist-delta";

const NOW = new Date("2026-10-21T12:00:00.000Z");

function entityOps(
  address: string,
  rows: { account_id?: string; contract_id?: string; op_count: number }[],
  field: "account_id" | "contract_id",
): number {
  return rows
    .filter((row) => row[field] === address)
    .reduce((total, row) => total + row.op_count, 0);
}

describe("watchlist delta math", () => {
  it("computes percent change and refuses a zero baseline", () => {
    assert.equal(activityDeltaPercent(150, 100), 50);
    assert.equal(activityDeltaPercent(80, 100), -20);
    assert.equal(activityDeltaPercent(10, 0), null);
    assert.equal(activityDeltaPercent(10, null), null);
    assert.equal(scalePreviousOps(100, 200, 50), 25);
    assert.equal(scalePreviousOps(10, 0, 5), null);
    assert.equal(formatActivityDelta(12.34), "+12.3%");
    assert.equal(formatActivityDelta(-2), "-2.0%");
    assert.equal(formatActivityDelta(null), "n/a");
    assert.equal(formatActivityDelta(0), "0.0%");
  });

  it("uses fixture account and contract rows for the active period", () => {
    const accounts = getFixtureRawActivity("1d");
    const kraken = fixtureWatchlistDelta(FIXTURE_ACCOUNTS.kraken, "1d", NOW);
    assert.equal(
      kraken.opCount,
      entityOps(FIXTURE_ACCOUNTS.kraken, accounts.accounts, "account_id"),
    );
    assert.ok((kraken.opCount ?? 0) > 0);

    const scaled = getFixtureRawActivity("7d");
    const week = fixtureWatchlistDelta(FIXTURE_ACCOUNTS.kraken, "7d", NOW);
    assert.equal(
      week.opCount,
      entityOps(FIXTURE_ACCOUNTS.kraken, scaled.accounts, "account_id"),
    );

    const contracts = getFixtureRawActivity("30d");
    const soroswap = fixtureWatchlistDelta(FIXTURE_CONTRACTS.soroswap, "30d", NOW);
    assert.equal(
      soroswap.opCount,
      entityOps(FIXTURE_CONTRACTS.soroswap, contracts.contracts, "contract_id"),
    );
  });

  it("is deterministic and follows the previous equal-length fixture window", () => {
    const first = fixtureWatchlistDelta(FIXTURE_ACCOUNTS.kraken, "month", NOW);
    const second = fixtureWatchlistDelta(FIXTURE_ACCOUNTS.kraken, "month", NOW);
    assert.deepEqual(first, second);

    const currentTotal = sumBucketOperations(
      getFixtureTimeseries("month", NOW).buckets,
    );
    const previousTotal = sumBucketOperations(
      getFixtureTimeseries("month", previousEqualAnchor("month", NOW)).buckets,
    );
    assert.notEqual(currentTotal, previousTotal);
    assert.equal(
      first.previousOps,
      scalePreviousOps(first.opCount ?? 0, currentTotal, previousTotal),
    );
    assert.equal(
      first.deltaPercent,
      activityDeltaPercent(first.opCount ?? 0, first.previousOps),
    );
    assert.notEqual(first.deltaPercent, null);
    assert.notEqual(first.deltaPercent, 0);

    const unknown = fixtureWatchlistDelta(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "7d",
      NOW,
    );
    assert.equal(unknown.opCount, 0);
    assert.equal(unknown.deltaPercent, null);
  });
});
