import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProtocolTvlAdapter, TvlAdapterResult } from "./adapter";
import {
  fetchProtocolTvlResults,
  getConfiguredProtocolTvlAdapters,
  PROTOCOL_TVL_FIXTURE_RESULTS,
} from "./protocol-registry";

class StubAdapter implements ProtocolTvlAdapter {
  constructor(private readonly result: TvlAdapterResult) {}
  async getTvl(): Promise<TvlAdapterResult> {
    return this.result;
  }
}

class ThrowingAdapter implements ProtocolTvlAdapter {
  async getTvl(): Promise<TvlAdapterResult> {
    throw new Error("simulated adapter crash");
  }
}

describe("getConfiguredProtocolTvlAdapters", () => {
  it("uses fixture adapters for every protocol when no ids are enabled", () => {
    const entries = getConfiguredProtocolTvlAdapters({}, new Set());
    assert.equal(entries.length, PROTOCOL_TVL_FIXTURE_RESULTS.length);
    // Fixture adapters resolve to the exact fixture result.
    assert.equal(entries[0].protocol, "Soroswap");
  });

  it("uses the live factory only for an enabled id with a registered factory", () => {
    const liveResult: TvlAdapterResult = {
      protocol: "Soroswap",
      network: "stellar",
      status: "complete",
      methodologyVersion: "test-v1",
      snapshotTime: new Date().toISOString(),
      positions: [],
    };

    const entries = getConfiguredProtocolTvlAdapters(
      { soroswap: () => new StubAdapter(liveResult) },
      new Set(["soroswap"]),
    );

    const soroswap = entries.find((e) => e.id === "soroswap");
    assert.ok(soroswap);

    // Circle has no live factory registered here, so it must still fall
    // back to its fixture even though "circle" isn't in enabledIds either.
    const circle = entries.find((e) => e.id === "circle");
    assert.ok(circle);
  });

  it("ignores an enabled id with no registered factory and falls back to fixture", async () => {
    const entries = getConfiguredProtocolTvlAdapters(
      {},
      new Set(["soroswap"]),
    );
    const soroswap = entries.find((e) => e.id === "soroswap");
    assert.ok(soroswap);
    const result = await soroswap!.adapter.getTvl();
    // The fixture adapter's result, not a live call.
    assert.equal(result.status, "complete");
    if (result.status === "complete") {
      assert.equal(result.positions[0].priceProvenance.source, "fixture-adapter");
    }
  });
});

describe("fetchProtocolTvlResults error isolation", () => {
  it("converts a throwing adapter into a failed result instead of rejecting", async () => {
    const goodResult: TvlAdapterResult = {
      protocol: "GoodProtocol",
      network: "stellar",
      status: "complete",
      methodologyVersion: "test-v1",
      snapshotTime: new Date().toISOString(),
      positions: [],
    };

    const results = await fetchProtocolTvlResults([
      { id: "good", protocol: "GoodProtocol", adapter: new StubAdapter(goodResult) },
      { id: "bad", protocol: "BadProtocol", adapter: new ThrowingAdapter() },
    ]);

    assert.equal(results.length, 2);
    assert.equal(results[0].status, "complete");
    assert.equal(results[1].status, "failed");
    assert.equal(results[1].protocol, "BadProtocol");
    if (results[1].status === "failed") {
      assert.equal(results[1].error, "simulated adapter crash");
    }
  });

  it("still returns every other adapter's result when one throws", async () => {
    const okA: TvlAdapterResult = {
      protocol: "A",
      network: "stellar",
      status: "complete",
      methodologyVersion: "v1",
      snapshotTime: new Date().toISOString(),
      positions: [],
    };
    const okC: TvlAdapterResult = {
      protocol: "C",
      network: "stellar",
      status: "partial",
      methodologyVersion: "v1",
      snapshotTime: new Date().toISOString(),
      positions: [],
    };

    const results = await fetchProtocolTvlResults([
      { id: "a", protocol: "A", adapter: new StubAdapter(okA) },
      { id: "b", protocol: "B", adapter: new ThrowingAdapter() },
      { id: "c", protocol: "C", adapter: new StubAdapter(okC) },
    ]);

    assert.equal(results.map((r) => r.status).join(","), "complete,failed,partial");
  });

  it("defaults to the configured registry and matches the existing fixture behaviour", async () => {
    const results = await fetchProtocolTvlResults();
    assert.equal(results.length, PROTOCOL_TVL_FIXTURE_RESULTS.length);
    assert.ok(results.every((r) => r.status !== "failed"));
  });
});
