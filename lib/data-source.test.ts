import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDataSource } from "@/lib/data-source";

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe("resolveDataSource", () => {
  it("defaults to live", () => {
    assert.equal(resolveDataSource(env({})), "live");
  });

  it("accepts fixture outside production", () => {
    assert.equal(
      resolveDataSource(env({ LUMENMAP_DATA_SOURCE: "fixture", NODE_ENV: "test" })),
      "fixture",
    );
  });

  it("rejects fixture in production", () => {
    assert.throws(
      () =>
        resolveDataSource(
          env({
            LUMENMAP_DATA_SOURCE: "fixture",
            NODE_ENV: "production",
          }),
        ),
      /not allowed in production/,
    );
  });
});
