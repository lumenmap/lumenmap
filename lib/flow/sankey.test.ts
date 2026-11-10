import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SANKEY_FLOW_FIXTURE,
  buildSankeyModel,
  resolveSankeyAssetCode,
} from "@/lib/flow/sankey";

describe("Sankey payment flow model (#455)", () => {
  it("restricts Sankey edges strictly to XLM and USDC and excludes other assets", () => {
    const model = buildSankeyModel({
      nodes: SANKEY_FLOW_FIXTURE.nodes,
      edges: SANKEY_FLOW_FIXTURE.edges,
      topN: 10,
    });

    assert.equal(model.links.length, 2);
    assert.deepEqual(
      model.links.map((l) => l.assetCode),
      ["XLM", "USDC"],
    );
    assert.equal(model.coverage.eligibleEdges, 2);
    assert.equal(model.coverage.totalEdges, 3);
    assert.equal(model.coverage.coveragePercent, 100);
    assert.equal(model.coverage.sampled, false);
  });

  it("enforces top-N cap and calculates operations-weighted coverage badge", () => {
    const model = buildSankeyModel({
      nodes: SANKEY_FLOW_FIXTURE.nodes,
      edges: SANKEY_FLOW_FIXTURE.edges,
      topN: 1,
    });

    assert.equal(model.links.length, 1);
    assert.equal(model.links[0].id, "edge-xlm-1");
    assert.equal(model.coverage.sampled, true);
    assert.equal(model.coverage.returnedEdges, 1);
    assert.equal(model.coverage.eligibleEdges, 2);
    assert.ok(model.coverage.coveragePercent > 50);
  });

  it("normalizes XLM and USDC asset keys", () => {
    assert.equal(
      resolveSankeyAssetCode({ assetKey: "native:XLM" }),
      "XLM",
    );
    assert.equal(
      resolveSankeyAssetCode({ assetKey: "USDC:GISSUER", asset: { code: "USDC" } }),
      "USDC",
    );
    assert.equal(
      resolveSankeyAssetCode({ assetKey: "EURC:GISSUER", asset: { code: "EURC" } }),
      null,
    );
  });
});
