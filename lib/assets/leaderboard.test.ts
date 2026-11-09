import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIXTURE_ASSET_LEADERBOARD_ROWS,
  mapAssetLeaderboardRows,
  parseSafeAssetAmount,
  sortAssetLeaderboard,
} from "./leaderboard";

describe("SAC and classic asset volume leaderboard panel (#448)", () => {
  it("maps >= 8 fixture assets across native, classic issuer, and SAC contracts with truncated unknown issuers", () => {
    const entries = mapAssetLeaderboardRows(FIXTURE_ASSET_LEADERBOARD_ROWS);
    assert.ok(entries.length >= 8);
    assert.equal(entries.length, 9);
    assert.equal(entries[0]?.code, "AQUA");

    const unknownSac = entries.find((e) => e.code === "BLND");
    assert.ok(unknownSac);
    assert.equal(unknownSac.kind, "sac");
    assert.equal(unknownSac.isKnownLabel, false);
    assert.ok(unknownSac.displayIssuer.includes("..."));
  });

  it("supports sorting by volume, opCount, share, and code", () => {
    const entries = mapAssetLeaderboardRows(FIXTURE_ASSET_LEADERBOARD_ROWS);
    const byOpsDesc = sortAssetLeaderboard(entries, "opCount", "desc");
    assert.equal(byOpsDesc[0]?.code, "XLM");

    const byCodeAsc = sortAssetLeaderboard(entries, "code", "asc");
    assert.equal(byCodeAsc[0]?.code, "AQUA");

    const byShareDesc = sortAssetLeaderboard(entries, "share", "desc");
    assert.equal(byShareDesc[0]?.code, "XLM");
  });

  it("soft-fails malformed or overflow asset amounts without throwing", () => {
    assert.equal(parseSafeAssetAmount("-10"), null);
    assert.equal(parseSafeAssetAmount("1e25"), null);
    assert.equal(parseSafeAssetAmount("not-a-number"), null);
    assert.equal(parseSafeAssetAmount("2500"), 2500);
  });
});
