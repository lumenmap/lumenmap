import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProtocolTvlTreemap } from "./build-protocol-treemap";
import { fetchProtocolTvlResults } from "./protocol-registry";
import type { TvlAdapterResult } from "./adapter";

describe("protocol TVL treemap", () => {
  it("builds sized tiles from adapter snapshots with status metadata", async () => {
    const results = await fetchProtocolTvlResults();
    const treemap = buildProtocolTvlTreemap(results);

    assert.equal(treemap.metric, "tvl");
    assert.ok(Number(treemap.value) > 0);
    assert.ok((treemap.children?.length ?? 0) >= 4);

    const stale = treemap.children?.find((child) => child.name === "LOBSTR");
    assert.ok(stale);
    assert.equal(stale?.meta?.adapterStatus, "stale");
    assert.equal(stale?.meta?.adapterStatusLabel, "Stale");
    assert.ok((stale?.meta?.tvlUsd ?? 0) > 0);
    assert.ok(stale?.meta?.snapshotTime);
  });

  it("surfaces a failed adapter as a visible zero-value tile instead of dropping it", () => {
    const results: TvlAdapterResult[] = [
      {
        protocol: "Working",
        network: "stellar",
        status: "complete",
        methodologyVersion: "1.0.0",
        snapshotTime: new Date().toISOString(),
        positions: [
          {
            canonicalAsset: "USD",
            nativeAmount: "1000",
            usdValue: "1000",
            priceProvenance: { source: "test", timestamp: new Date().toISOString() },
          },
        ],
      },
      {
        protocol: "Broken",
        network: "stellar",
        status: "failed",
        snapshotTime: new Date().toISOString(),
        error: "simulated failure",
      },
    ];

    // Must not throw — a failed adapter result must never crash the page.
    const treemap = buildProtocolTvlTreemap(results);

    const broken = treemap.children?.find((child) => child.name === "Broken");
    assert.ok(broken, "failed adapter must still produce a tile");
    assert.equal(broken?.meta?.adapterStatus, "failed");
    assert.equal(broken?.meta?.adapterStatusLabel, "Failed");
    assert.equal(broken?.meta?.tvlUsd, 0);
    assert.equal(broken?.color, "#6B7280");

    // The failed tile must not inflate the total or the working tile's share.
    assert.equal(treemap.value, "1000");
    const working = treemap.children?.find((child) => child.name === "Working");
    assert.equal(working?.meta?.share, 100);
  });

  it("surfaces an unsupported adapter as a visible zero-value tile", () => {
    const results: TvlAdapterResult[] = [
      {
        protocol: "NotYetSupported",
        network: "stellar",
        status: "unsupported",
        snapshotTime: new Date().toISOString(),
        reason: "no live adapter registered",
      },
    ];

    const treemap = buildProtocolTvlTreemap(results);
    const tile = treemap.children?.find((c) => c.name === "NotYetSupported");
    assert.ok(tile);
    assert.equal(tile?.meta?.adapterStatusLabel, "Unsupported");
    assert.equal(tile?.meta?.tvlUsd, 0);
  });
});
