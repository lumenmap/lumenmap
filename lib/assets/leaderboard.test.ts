import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ASSET_LEADERBOARD_FIXTURE } from "./leaderboard-fixture";
import { rankAssetVolumes, sortLeaderboard } from "./leaderboard";

describe("asset volume leaderboard", () => {
  it("ranks eight assets and drops the unparseable amount", () => {
    const result = rankAssetVolumes(ASSET_LEADERBOARD_FIXTURE);
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.equal(result.rows.length, 8);
    assert.equal(result.dropped, 1);
    assert.equal(result.rows[0].code, "XLM");
    assert.equal(result.rows[0].kind, "native");
    assert.equal(result.rows.find((row) => row.code === "yXLM")?.kind, "sac");
    assert.equal(result.rows.find((row) => row.code === "EURC")?.kind, "classic");
    const share = result.rows.reduce((sum, row) => sum + row.share, 0);
    assert.ok(Math.abs(share - 1) < 1e-9);
  });

  it("sorts by operation count without changing the parsed rows", () => {
    const result = rankAssetVolumes(ASSET_LEADERBOARD_FIXTURE);
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    const sorted = sortLeaderboard(result.rows, "opCount", "asc");
    assert.equal(sorted[0].opCount <= sorted[1].opCount, true);
    assert.equal(result.rows[0].code, "XLM");
  });

  it("soft-fails when nothing can be parsed", () => {
    assert.equal(rankAssetVolumes(null).status, "unavailable");
    assert.equal(rankAssetVolumes([{ amount: "nope" }]).status, "unavailable");
  });
});
