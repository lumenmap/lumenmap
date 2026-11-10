import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROTOCOL_TAGS,
  filterEntitiesByTags,
  getAllEntities,
  getEntityTags,
  isValidProtocolTag,
} from "@/lib/entities/registry";
import {
  parseDashboardUrlSearch,
  writeDashboardUrlSearch,
} from "@/lib/dashboard-url-state";

describe("protocol tag taxonomy and filters", () => {
  it("validates canonical protocol tags and loads curated entity tags", () => {
    assert.equal(isValidProtocolTag("dex"), true);
    assert.equal(isValidProtocolTag("stablecoin"), true);
    assert.equal(isValidProtocolTag("invalid"), false);
    assert.ok(PROTOCOL_TAGS.length >= 10);

    const soroswapTags = getEntityTags(
      "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    );
    assert.deepEqual(soroswapTags, ["dex"]);

    const circleTags = getEntityTags(
      "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    );
    assert.deepEqual(circleTags, ["stablecoin", "payments"]);
  });

  it("filters entities by one or more protocol tags", () => {
    const all = getAllEntities();
    const dexOnly = filterEntitiesByTags(all, ["dex"]);
    assert.ok(
      "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2" in dexOnly,
    );
    assert.ok(
      !("GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" in dexOnly),
    );

    const unfiltered = filterEntitiesByTags(all, []);
    assert.equal(Object.keys(unfiltered).length, Object.keys(all).length);
  });

  it("round-trips protocol tag filters through dashboard URL search params", () => {
    const search = writeDashboardUrlSearch({
      period: "7d",
      metric: "ops",
      view: "actors",
      path: [],
      tags: ["dex", "stablecoin"],
    });
    assert.ok(search.includes("tags=dex%2Cstablecoin"));

    const parsed = parseDashboardUrlSearch(search);
    assert.deepEqual(parsed.tags, ["dex", "stablecoin"]);
  });
});
