import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSankeyModel,
  resolveSankeyAssetCode,
  SANKEY_FIXTURE_EDGES,
  SANKEY_FIXTURE_NODES,
} from "./sankey-flow";

describe("Sankey alternative for top payment flows (#455)", () => {
  it("restricts Sankey flows strictly to XLM and USDC assets", () => {
    assert.equal(resolveSankeyAssetCode({ assetKey: "native:XLM" }), "XLM");
    assert.equal(
      resolveSankeyAssetCode({
        assetKey: "USDC:GA5Z",
        asset: { code: "USDC" },
      }),
      "USDC",
    );
    assert.equal(
      resolveSankeyAssetCode({
        assetKey: "AQUA:GBNZ",
        asset: { code: "AQUA" },
      }),
      null,
    );
  });

  it("ranks top-N XLM/USDC payment edges and exposes cap and coverage badges", () => {
    const edges = [
      ...SANKEY_FIXTURE_EDGES,
      {
        id: "ignored-aqua",
        source: "GAAA",
        destination: "GDDD",
        assetKey: "AQUA:GBNZ",
        asset: { code: "AQUA" },
        amount: "999999999999",
        operationCount: 999,
      },
    ];

    const model = buildSankeyModel(SANKEY_FIXTURE_NODES, edges, { topN: 2 });
    assert.equal(model.totalEligibleEdges, 3);
    assert.equal(model.returnedEdges, 2);
    assert.equal(model.sampled, true);
    assert.equal(model.bands[0]?.id, "sankey-1");
    assert.equal(model.bands[0]?.assetCode, "XLM");
    assert.equal(model.bands[1]?.id, "sankey-2");
    assert.equal(model.bands[1]?.assetCode, "USDC");
    assert.ok(model.capBadgeText.includes("Top 2 XLM/USDC cap (2 of 3 edges)"));
    assert.ok(model.coverageBadgeText.includes("% of XLM/USDC operations"));
  });
});
