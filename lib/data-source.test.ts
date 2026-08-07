import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFixtureMode, resolveDataSource } from "@/lib/data-source";

describe("resolveDataSource", () => {
  it("defaults to live", () => {
    assert.equal(resolveDataSource({}), "live");
    assert.equal(resolveDataSource({ LUMENMAP_DATA_SOURCE: "live" }), "live");
  });

  it("accepts fixture outside production", () => {
    assert.equal(
      resolveDataSource({ LUMENMAP_DATA_SOURCE: "fixture", NODE_ENV: "development" }),
      "fixture",
    );
    assert.equal(
      isFixtureMode({ LUMENMAP_DATA_SOURCE: "fixture", NODE_ENV: "test" }),
      true,
    );
  });

  it("blocks fixture mode in production runtimes", () => {
    assert.throws(
      () =>
        resolveDataSource({
          LUMENMAP_DATA_SOURCE: "fixture",
          NODE_ENV: "production",
        }),
      /not allowed in production/,
    );
    assert.throws(
      () =>
        resolveDataSource({
          LUMENMAP_DATA_SOURCE: "fixture",
          VERCEL_ENV: "production",
        }),
      /not allowed in production/,
    );
  });

  it("rejects unknown values", () => {
    assert.throws(
      () => resolveDataSource({ LUMENMAP_DATA_SOURCE: "mock" }),
      /Unknown LUMENMAP_DATA_SOURCE/,
    );
  });
});
