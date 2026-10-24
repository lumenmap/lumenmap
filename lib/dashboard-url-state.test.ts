import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TreemapNode } from "@/lib/types";
import {
  decodeDrillPathParam,
  encodeDrillPath,
  isValidChartView,
  isValidMetric,
  parseDashboardUrlSearch,
  resolveDrillPath,
  writeDashboardUrlSearch,
} from "./dashboard-url-state";

const sampleRoot: TreemapNode = {
  name: "Network Activity",
  children: [
    {
      id: "soroban",
      name: "Soroban",
      value: 100,
      children: [
        {
          id: "invoke_host_function",
          name: "invoke_host_function",
          value: 80,
        },
      ],
    },
    {
      name: "Payments",
      value: 50,
    },
  ],
};

describe("dashboard URL state", () => {
  it("validates known metrics only", () => {
    assert.equal(isValidMetric("ops"), true);
    assert.equal(isValidMetric("usdc"), true);
    assert.equal(isValidMetric("protocol_tvl"), true);
    assert.equal(isValidMetric("tvl"), false);
    assert.equal(isValidMetric(null), false);
  });

  it("parses period and metric from search params", () => {
    const parsed = parseDashboardUrlSearch(
      "?period=7d&metric=xlm_volume&view=actors&q=Soroban",
    );
    assert.equal(parsed.period, "7d");
    assert.equal(parsed.metric, "xlm_volume");
    assert.equal(parsed.view, "actors");
    assert.equal(parsed.searchQuery, "Soroban");
  });

  it("ignores invalid period and metric values", () => {
    const parsed = parseDashboardUrlSearch("?period=90d&metric=nope");
    assert.equal(parsed.period, undefined);
    assert.equal(parsed.metric, undefined);
  });

  it("encodes and restores drill path segments", () => {
    const path = resolveDrillPath(sampleRoot, [
      "soroban",
      "invoke_host_function",
    ]);
    assert.equal(path.length, 2);
    assert.equal(path[1].name, "invoke_host_function");

    const encoded = encodeDrillPath(path);
    assert.equal(encoded, "soroban/invoke_host_function");
    assert.deepEqual(decodeDrillPathParam(encoded), [
      "soroban",
      "invoke_host_function",
    ]);
  });

  it("stops restoring at the first missing path segment", () => {
    const path = resolveDrillPath(sampleRoot, ["soroban", "missing"]);
    assert.equal(path.length, 1);
    assert.equal(path[0].name, "Soroban");
  });

  it("writes period, metric, view, and path into the query string", () => {
    const path = resolveDrillPath(sampleRoot, ["Payments"]);
    const search = writeDashboardUrlSearch({
      period: "30d",
      metric: "transactions",
      view: "events",
      searchQuery: "Stellar account",
      path,
      currentSearch: "?utm=keep",
    });
    assert.match(search, /period=30d/);
    assert.match(search, /metric=transactions/);
    assert.match(search, /view=events/);
    assert.match(search, /path=Payments/);
    assert.match(search, /q=Stellar\+account/);
    assert.match(search, /utm=keep/);
  });

  it("round-trips comparison period state", () => {
    const search = writeDashboardUrlSearch({
      period: "1d",
      comparePeriod: "7d",
      metric: "ops",
      view: "events",
      path: [],
    });
    assert.equal(parseDashboardUrlSearch(search).comparePeriod, "7d");
  });

  it("preserves an address comparison while changing the active period", () => {
    const first = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
    const second = "GBKMNW2R7QZQF2ZDHBUXC3LKSRMURBPNBDD7N2TDRVSJTTHU3QFAARP2";
    const search = writeDashboardUrlSearch({
      period: "7d", metric: "ops", view: "events", path: [],
      currentSearch: `?compare=${first},${second}`,
    });
    assert.equal(new URLSearchParams(search).get("compare"), `${first},${second}`);
    assert.equal(parseDashboardUrlSearch(search).comparePeriod, undefined);
  });

  it("parses and writes flow mode from URL", () => {
    const parsed = parseDashboardUrlSearch("?flowMode=table");
    assert.equal(parsed.flowMode, "table");

    const search = writeDashboardUrlSearch({
      period: "1d",
      metric: "ops",
      view: "events",
      path: [],
      flowMode: "graph",
    });
    assert.match(search, /flowMode=graph/);
  });

  it("parses and writes ego address from URL", () => {
    const address = "GABC7SWIAIXR4BWLLCVMAVYLFZMFQBWRFRGFTRWGIWG7E5KZLBFZ7KGP";
    const parsed = parseDashboardUrlSearch(`?ego=${address}`);
    assert.equal(parsed.egoAddress, address);

    const search = writeDashboardUrlSearch({
      period: "1d",
      metric: "ops",
      view: "events",
      path: [],
      egoAddress: address,
    });
    assert.match(search, new RegExp(`ego=${address}`));
  });

  it("ignores invalid ego address", () => {
    const parsed1 = parseDashboardUrlSearch("?ego=invalid");
    assert.equal(parsed1.egoAddress, undefined);

    const parsed2 = parseDashboardUrlSearch("?ego=AABC7SWIAIXR4BWLLCVMAVYLFZMFQBWRFRGFTRWGIWG7E5KZLBFZ7KGP");
    assert.equal(parsed2.egoAddress, undefined);
  });

  it("ignores invalid flow mode", () => {
    const parsed = parseDashboardUrlSearch("?flowMode=invalid");
    assert.equal(parsed.flowMode, undefined);
  });

  it("round-trips flow state with ego address", () => {
    const address = "GABC7SWIAIXR4BWLLCVMAVYLFZMFQBWRFRGFTRWGIWG7E5KZLBFZ7KGP";
    const search = writeDashboardUrlSearch({
      period: "7d",
      metric: "ops",
      view: "actors",
      path: [],
      flowMode: "table",
      egoAddress: address,
    });

    const parsed = parseDashboardUrlSearch(search);
    assert.equal(parsed.flowMode, "table");
    assert.equal(parsed.egoAddress, address);
  });

  it("clears flow params when set to null", () => {
    const search = writeDashboardUrlSearch({
      period: "1d",
      metric: "ops",
      view: "events",
      path: [],
      currentSearch: "?flowMode=graph&ego=GABC7SWIAIXR4BWLLCVMAVYLFZMFQBWRFRGFTRWGIWG7E5KZLBFZ7KGP",
      flowMode: null,
      egoAddress: null,
    });
    assert.doesNotMatch(search, /flowMode/);
    assert.doesNotMatch(search, /ego/);
  });

  it("parses the treemap diff flag from the URL", () => {
    assert.equal(parseDashboardUrlSearch("?diff=1").treemapDiff, true);
    assert.equal(parseDashboardUrlSearch("?diff=true").treemapDiff, true);
    assert.equal(parseDashboardUrlSearch("?diff=0").treemapDiff, undefined);
    assert.equal(parseDashboardUrlSearch("?diff=nope").treemapDiff, undefined);
    assert.equal(parseDashboardUrlSearch("").treemapDiff, undefined);
  });

  it("round-trips the treemap diff flag", () => {
    const search = writeDashboardUrlSearch({
      period: "7d",
      metric: "ops",
      view: "events",
      path: [],
      treemapDiff: true,
    });
    assert.match(search, /diff=1/);
    assert.equal(parseDashboardUrlSearch(search).treemapDiff, true);
  });

  it("clears the treemap diff flag when toggled off", () => {
    const search = writeDashboardUrlSearch({
      period: "7d",
      metric: "ops",
      view: "events",
      path: [],
      currentSearch: "?diff=1",
      treemapDiff: false,
    });
    assert.doesNotMatch(search, /diff=/);
  });
});
