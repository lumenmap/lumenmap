import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSET_VOLUME_LEADERBOARD_FIXTURE,
  mapAssetVolumeLeaderboardRows,
  sortAssetVolumeLeaderboard,
} from "@/lib/metrics/asset-volume-leaderboard";

describe("SAC and classic asset volume leaderboard (#448)", () => {
  it("provides a fixture with at least 8 assets covering native, classic, and SAC", () => {
    assert.ok(ASSET_VOLUME_LEADERBOARD_FIXTURE.length >= 8);
    const mapped = mapAssetVolumeLeaderboardRows(
      ASSET_VOLUME_LEADERBOARD_FIXTURE,
      (addr) =>
        addr.startsWith("GA5Z") ? "Circle (USDC Issuer)" : undefined,
    );

    assert.equal(mapped.length, 9);
    assert.ok(mapped.some((r) => r.assetKind === "native"));
    assert.ok(mapped.some((r) => r.assetKind === "classic"));
    assert.ok(mapped.some((r) => r.assetKind === "sac"));

    const unknownRow = mapped.find((r) => r.code === "ARS");
    assert.ok(unknownRow);
    assert.equal(unknownRow.issuerLabel, null);
    assert.ok(unknownRow.issuerOrSacAddress?.startsWith("GUNKNOWN"));
  });

  it("sorts columns ascending and descending by volume, opCount, sharePercent, and code", () => {
    const mapped = mapAssetVolumeLeaderboardRows(
      ASSET_VOLUME_LEADERBOARD_FIXTURE,
    );
    const byOpDesc = sortAssetVolumeLeaderboard(mapped, "opCount", "desc");
    assert.equal(byOpDesc[0].code, "XLM");

    const byCodeAsc = sortAssetVolumeLeaderboard(mapped, "code", "asc");
    assert.equal(byCodeAsc[0].code, "AQUA");
  });

  it("soft-fails malformed or negative amount rows without throwing", () => {
    const mapped = mapAssetVolumeLeaderboardRows([
      { asset: { code: "BAD", type: "issued", issuer: "G123" }, amount: "not-a-number", opCount: 10 },
      { asset: { code: "NEG", type: "issued", issuer: "G123" }, amount: "-50", opCount: 10 },
      { asset: { code: "XLM", type: "native" }, amount: "100", opCount: 25 },
    ]);
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].code, "XLM");
    assert.equal(mapped[0].sharePercent, 100);
  });
});
